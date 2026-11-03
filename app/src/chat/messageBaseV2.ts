import { File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { abrirCache, cederAlHilo, type Envelope } from '@lilachat/shared';
import { isWrongKeyError, rawKeyPragma, singleFlight } from './storedRows';
import type { ChatMessage } from './useChat';

/**
 * Version 2 of the phone's message base (plan 1, F5b), and the move from
 * version 1.
 *
 * Version 1 (`lilachat.db`) keeps each message as an AES-GCM envelope made in
 * JavaScript. Version 2 (`lilachat-v2.db`) is a SQLCipher base: the whole file
 * is encrypted in native code with the same 32-byte key, and the rows inside are
 * in clear. The table and its columns keep their names (`mensajes`, `sobre`) so
 * every query of `mensajesGuardados` serves both; in version 2 `sobre` holds the
 * message JSON and `body` its text, for the local search.
 *
 * The move goes chat by chat: whoever needs a chat migrates it first (one run
 * per chat), and the rest goes in the background, yielding the thread between
 * pages. A version 1 row is deleted only after its copy is committed in version
 * 2, so a move cut in half resumes without losing anything.
 */
const NAME_V1 = 'lilachat.db';
const NAME_V2 = 'lilachat-v2.db';
/** Rows moved per step: each one is decrypted in JavaScript one last time. */
const MOVE_PAGE = 100;
/** Where expo-sqlite keeps its files (`useLocalStorage` measures the same folder). */
const DATABASE_FOLDER = 'SQLite';

const SCHEMA_V2 = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS mensajes (
    chatId TEXT NOT NULL,
    seq INTEGER NOT NULL,
    sobre TEXT NOT NULL,
    body TEXT,
    PRIMARY KEY (chatId, seq)
  );
`;

type LegacyRow = { seq: number; sobre: string };

/** The base and its WAL companions: a WAL left from another key would be replayed into the new base. */
function deleteBaseFiles(name: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = new File(Paths.document, DATABASE_FOLDER, `${name}${suffix}`);
    if (file.exists) file.delete();
  }
}
/** Writes moved rows into version 2 without overwriting newer ones (`INSERT OR IGNORE`). */
export type WriteMoved = (chatId: string, messages: readonly ChatMessage[]) => Promise<unknown>;

function openWithKey(key: Uint8Array): SQLite.SQLiteDatabase | null {
  const opened = SQLite.openDatabaseSync(NAME_V2);
  try {
    opened.execSync(rawKeyPragma(key));
    // Plain SQLite takes `PRAGMA key` as a no-op: without this row the file would hold the messages in clear.
    if (!opened.getFirstSync<{ cipher_version: string }>('PRAGMA cipher_version')?.cipher_version) {
      opened.closeSync();
      return null;
    }
    opened.execSync(SCHEMA_V2);
    return opened;
  } catch (error) {
    opened.closeSync();
    throw error;
  }
}

/**
 * The version 2 base, or `null` when this binary has no SQLCipher (an older
 * APK) or the base does not open: then version 1 stays in use, as before F5b.
 * Only a base this key cannot open is started anew.
 */
export function openEncryptedBase(key: Uint8Array): SQLite.SQLiteDatabase | null {
  try {
    return openWithKey(key);
  } catch (error) {
    if (!isWrongKeyError(error)) return null;
    try {
      deleteBaseFiles(NAME_V2);
      return openWithKey(key);
    } catch {
      return null;
    }
  }
}

/** Closes version 2 on logout (it was opened with the key just deleted); returns the empty slot. */
export function closedBase(opened: SQLite.SQLiteDatabase | null): null {
  try {
    opened?.closeSync();
  } catch {
    // Already closed: nothing to release.
  }
  return null;
}

let legacy: SQLite.SQLiteDatabase | null = null;
let pendingChats: Set<string> | null = null;
const moveOnce = singleFlight<string, void>();

/** Opening a missing version 1 file would create it again, empty, on every start. */
function legacyExists(): boolean {
  return legacy !== null || new File(Paths.document, DATABASE_FOLDER, NAME_V1).exists;
}

function legacyBase(): SQLite.SQLiteDatabase {
  if (!legacy) legacy = SQLite.openDatabaseSync(NAME_V1);
  return legacy;
}

/** The chats that still have rows in version 1, read once per process. */
function pending(): Set<string> {
  if (!pendingChats && !legacyExists()) pendingChats = new Set();
  if (!pendingChats) {
    try {
      const rows = legacyBase().getAllSync<{ chatId: string }>('SELECT DISTINCT chatId FROM mensajes');
      pendingChats = new Set(rows.map((row) => row.chatId));
    } catch {
      // No version 1 table: nothing to move.
      pendingChats = new Set();
    }
  }
  return pendingChats;
}

/** Whether a chat can be read from version 2 right now (the sync read asks this). */
export function chatMoved(chatId: string): boolean {
  return !pending().has(chatId);
}

/** A row that does not open (another key, a corrupt envelope) is left behind: it never blocks its chat. */
function openLegacyRows(key: Uint8Array, rows: readonly LegacyRow[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const row of rows) {
    try {
      const message = abrirCache<ChatMessage>(key, JSON.parse(row.sobre) as Envelope);
      if (message) messages.push(message);
    } catch {
      continue;
    }
  }
  return messages;
}

async function moveChatRows(chatId: string, key: Uint8Array, write: WriteMoved): Promise<void> {
  const old = legacyBase();
  for (;;) {
    const rows = await old.getAllAsync<LegacyRow>(
      'SELECT seq, sobre FROM mensajes WHERE chatId = ? ORDER BY seq ASC LIMIT ?',
      chatId,
      MOVE_PAGE
    );
    if (rows.length === 0) break;
    await write(chatId, openLegacyRows(key, rows));
    const last = rows[rows.length - 1]!.seq;
    await old.runAsync('DELETE FROM mensajes WHERE chatId = ? AND seq <= ?', chatId, last);
    await cederAlHilo();
  }
  pending().delete(chatId);
}

/** Moves one chat before anyone reads or changes it in version 2. Free once it moved. */
export function ensureChatMoved(chatId: string, key: Uint8Array, write: WriteMoved): Promise<void> {
  if (chatMoved(chatId)) return Promise.resolve();
  return moveOnce(chatId, () => moveChatRows(chatId, key, write));
}

/** Every chat left, one after the other, and then the version 1 file goes away. */
export async function moveAllChats(key: Uint8Array, write: WriteMoved): Promise<void> {
  for (const chatId of [...pending()]) await ensureChatMoved(chatId, key, write);
  dropLegacyFile();
}

function dropLegacyFile(): void {
  if (!legacy) return;
  try {
    legacy.closeSync();
    legacy = null;
    deleteBaseFiles(NAME_V1);
  } catch {
    // An empty version 1 file left behind costs a few KB; it is tried again on the next start.
  }
}

/** On logout: whatever version 1 still kept goes too, and the next session reads the list again. */
export async function forgetLegacyRows(): Promise<void> {
  pendingChats = null;
  if (!legacyExists()) return;
  try {
    await legacyBase().runAsync('DELETE FROM mensajes');
  } catch {
    // No version 1 table: nothing to forget.
  }
}

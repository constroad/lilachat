/**
 * The rows of the phone's message base, version 2 (plan 1, F5b). PURE.
 *
 * Version 1 (F12.0, 15/09) encrypted every row with the AES-GCM engine of F9,
 * in JavaScript: opening a chat decrypted 50 envelopes on the JS thread.
 * Version 2 is a SQLCipher base: the whole file is encrypted in native code
 * (what Signal does), and inside it the message is in clear. The key is the
 * same 32 bytes of `expo-secure-store` that version 1 used.
 */
export type StoredRow = { seq: number; body: string | null; json: string };

const KEY_BYTES = 32;

/**
 * SQLCipher's raw key. A passphrase would run PBKDF2 (256 000 rounds) on every
 * open; 32 random bytes need no derivation.
 */
export function rawKeyPragma(key: Uint8Array): string {
  if (key.length !== KEY_BYTES) throw new Error('key_must_be_32_bytes');
  const hex = Array.from(key, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `PRAGMA key = "x'${hex}'";`;
}

/** The body goes in its own column for the local search (F12.3); the message whole goes in `json`. */
export function rowOfMessage(message: { seq: number; body?: string }): StoredRow {
  return { seq: message.seq, body: typeof message.body === 'string' ? message.body : null, json: JSON.stringify(message) };
}

/** A row that does not parse is skipped: the server sends it again when the hydrator sees the gap. */
export function messagesOfRows<T>(rows: readonly { json: string }[]): T[] {
  const messages: T[] = [];
  for (const row of rows) {
    try {
      messages.push(JSON.parse(row.json) as T);
    } catch {
      continue;
    }
  }
  return messages;
}

/**
 * The base cannot be opened with this key (SQLITE_NOTADB): the key was lost or
 * changed, so its rows are unreadable for good. Only this error allows starting
 * a new base; a full disk or a busy base must never delete history.
 */
export function isWrongKeyError(error: unknown): boolean {
  return error instanceof Error && /file is not a database/i.test(error.message);
}

/** One run per key at a time: a chat's migration is shared by everyone who needs that chat. */
export function singleFlight<K, V>(): (key: K, run: () => Promise<V>) => Promise<V> {
  const inFlight = new Map<K, Promise<V>>();
  return (key, run) => {
    const current = inFlight.get(key);
    if (current) return current;
    const started = run().finally(() => inFlight.delete(key));
    inFlight.set(key, started);
    return started;
  };
}

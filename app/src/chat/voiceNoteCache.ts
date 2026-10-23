import { useEffect, useSyncExternalStore } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { voiceNoteFileName } from './voiceNoteName';

/**
 * Voice notes downloaded to the phone, like WhatsApp's automatic download
 * (José, 21/10: «carga y luego reproduce»): a note in sight is fetched in the
 * background, and play reads it from the disk at once instead of waiting for
 * the network. Two at a time, so they do not fight with the photos; the
 * system clears the cache folder when it needs space.
 */
const FOLDER = 'voz';
const PARALLEL = 2;

const local = new Map<string, string>();
/** Notes already looked for on the disk this session: a render does not stat the file again. */
const checked = new Set<string>();
const queue: string[] = [];
const queued = new Set<string>();
let running = 0;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());

function fileFor(url: string): File | null {
  const name = voiceNoteFileName(url);
  if (!name) return null;
  const folder = new Directory(Paths.cache, FOLDER);
  if (!folder.exists) folder.create({ intermediates: true });
  return new File(folder, name);
}

/** The note's file on the phone, if it is already there. */
function knownLocal(url: string): string | undefined {
  const cached = local.get(url);
  if (cached || checked.has(url)) return cached;
  checked.add(url);
  try {
    const file = fileFor(url);
    if (file?.exists && file.size > 0) {
      local.set(url, file.uri);
      return file.uri;
    }
  } catch {
    // An unreadable cache only means the note plays from the network, as before.
  }
  return undefined;
}

async function download(url: string): Promise<void> {
  const file = fileFor(url);
  if (!file) return;
  // A partial file from an interrupted download is replaced, never played.
  const done = await File.downloadFileAsync(url, file, { idempotent: true });
  local.set(url, done.uri);
  announce();
}

function pump(): void {
  while (running < PARALLEL && queue.length) {
    const url = queue.shift()!;
    running += 1;
    void download(url)
      .catch((error: unknown) => console.warn('[voz] no se pudo bajar la nota:', error instanceof Error ? error.message : error))
      .finally(() => {
        running -= 1;
        queued.delete(url);
        pump();
      });
  }
}

/** After «Liberar» deleted the folder (pending 13): what was known on the disk is gone, the notes play from the network again. */
export function forgetDownloadedVoiceNotes(): void {
  local.clear();
  checked.clear();
  announce();
}

export function prefetchVoiceNote(url: string | undefined): void {
  if (!url || url.startsWith('file:') || queued.has(url) || knownLocal(url)) return;
  queued.add(url);
  queue.push(url);
  pump();
}

/** The local file of a remote note once it is on the phone (starting its download), else the remote URL. */
export function useVoiceNoteSource(url: string | undefined): string | undefined {
  useEffect(() => {
    prefetchVoiceNote(url);
  }, [url]);
  const localUri = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (url ? (local.get(url) ?? null) : null)
  );
  return localUri ?? (url ? knownLocal(url) : undefined) ?? url;
}

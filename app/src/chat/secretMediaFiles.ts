import { useSyncExternalStore } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import type { MediaSecret } from '@lilachat/shared';
import { openFile } from '../crypto/sealedFiles';
import { openedFileName, type SecretFile } from './secretMedia';

/**
 * The decrypted copies of a secret chat's photos and videos (pending 67 /
 * F12.3): the encrypted file is downloaded, decrypted chunk by chunk into the
 * cache folder and deleted; the bubble and the viewer read the copy. Two at a
 * time, like the voice notes; the system clears the folder when it needs room.
 */
const FOLDER = 'secreto';
const PARALLEL = 2;
const SEALED_SUFFIX = '.sellado';

type Job = { url: string; secret: MediaSecret; name: string };
const known = new Map<string, SecretFile>();
const queue: Job[] = [];
let running = 0;
let version = 0;
const listeners = new Set<() => void>();

function announce(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

function folder(): Directory {
  const directory = new Directory(Paths.cache, FOLDER);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

async function openOne(job: Job): Promise<void> {
  const sealed = await File.downloadFileAsync(job.url, new File(folder(), `${job.name}${SEALED_SUFFIX}`), { idempotent: true });
  const plain = new File(folder(), job.name);
  try {
    await openFile(sealed, plain, job.secret.key);
  } finally {
    if (sealed.exists) sealed.delete();
  }
  known.set(job.url, { uri: plain.uri });
}

function pump(): void {
  while (running < PARALLEL && queue.length > 0) {
    const job = queue.shift()!;
    running += 1;
    void openOne(job)
      .catch((error: unknown) => {
        console.warn('[secreto] no se pudo abrir el archivo:', error instanceof Error ? error.message : error);
        known.set(job.url, { failed: true });
      })
      .finally(() => {
        running -= 1;
        announce();
        pump();
      });
  }
}

/** The decrypted copy of a sealed file, or `{}` while it is being opened (the first ask starts it). */
export function secretFileOf(url: string, secret: MediaSecret): SecretFile {
  const found = known.get(url);
  if (found) return found;
  const name = openedFileName(url, secret.mime);
  if (!name) return { failed: true };
  try {
    const file = new File(folder(), name);
    if (file.exists && file.size > 0) {
      const ready = { uri: file.uri };
      known.set(url, ready);
      return ready;
    }
  } catch (error) {
    console.warn('[secreto] no se pudo leer la caché:', error instanceof Error ? error.message : error);
  }
  known.set(url, {});
  queue.push({ url, secret, name });
  // Out of the render that asked: it only schedules.
  setTimeout(pump, 0);
  return {};
}

/** What I just sent is already on my phone: its copy is kept, it is not downloaded and decrypted again. */
export function rememberOpened(url: string, mime: string, plainUri: string): void {
  const name = openedFileName(url, mime);
  if (!name) return;
  try {
    const target = new File(folder(), name);
    if (!target.exists) new File(plainUri).copy(target);
    known.set(url, { uri: target.uri });
    announce();
  } catch (error) {
    console.warn('[secreto] no se pudo guardar la copia propia:', error instanceof Error ? error.message : error);
  }
}

/** Changes when a copy is ready or failed: the chat derives its messages again. */
export function useSecretFilesVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version
  );
}

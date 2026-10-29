import { File, FileMode } from 'expo-file-system';
import { MEDIA_CHUNK, openMediaChunk, sealMediaChunk, sealedMediaSize, type MediaKey } from '@lilachat/shared';

/**
 * A secret chat's photo or video encrypted and decrypted file to file (pending
 * 67 / F12.3), one chunk of 256 KiB at a time: a 90 MB video never sits whole
 * in memory, and the screen gets a frame between chunks.
 */
const TAG_BYTES = 16;
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type ChunkStep = (index: number, bytes: Uint8Array, last: boolean) => Uint8Array;

async function transform(from: File, to: File, readSize: number, step: ChunkStep): Promise<void> {
  const size = from.size;
  const count = Math.max(1, Math.ceil(size / readSize));
  if (to.exists) to.delete();
  to.create();
  const input = from.open(FileMode.ReadOnly);
  const output = to.open(FileMode.Truncate);
  let failure: unknown = null;
  try {
    for (let index = 0; index < count; index += 1) {
      const bytes = input.readBytes(Math.min(readSize, size - index * readSize));
      output.writeBytes(step(index, bytes, index === count - 1));
      await nextFrame();
    }
  } catch (error) {
    failure = error;
  } finally {
    input.close();
    output.close();
  }
  if (failure === null) return;
  // Half a file is worse than none: a broken copy would be shown or sent.
  if (to.exists) to.delete();
  throw failure;
}

/** Encrypts `from` into `to`; returns the size of the encrypted file. */
export async function sealFile(from: File, to: File, key: MediaKey): Promise<number> {
  await transform(from, to, MEDIA_CHUNK, (index, bytes, last) => sealMediaChunk(key, index, bytes, last));
  return sealedMediaSize(from.size);
}

/** Decrypts `from` into `to`; throws (and leaves no `to`) when a chunk was changed, moved or cut. */
export async function openFile(from: File, to: File, key: MediaKey): Promise<void> {
  await transform(from, to, MEDIA_CHUNK + TAG_BYTES, (index, bytes, last) => openMediaChunk(key, index, bytes, last));
}

import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { base64ToBytes, bytesToBase64 } from './e2ee.js';

/**
 * The photos and videos of a secret chat (pending 67 / F12.3, José 29/10):
 * each file gets its own random key, the file goes up already encrypted, and
 * the key travels INSIDE the end-to-end sealed text of the message, so the
 * server keeps bytes it cannot read. PURE.
 *
 * By chunks of 256 KiB, so a phone never holds a whole video twice: each
 * chunk is ChaCha20-Poly1305 with the nonce `prefix(8) ‖ index(4)` and the
 * «last chunk» flag as associated data — moving, dropping or cutting chunks
 * fails to open. ChaCha and not AES-GCM: in pure JavaScript it measured 33 MB/s
 * against 6 (Node, 29/10), and a phone without native AES pays that per video.
 */
export const MEDIA_CHUNK = 256 * 1024;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const PREFIX_BYTES = 8;
const LAST = Uint8Array.of(1);
const NOT_LAST = Uint8Array.of(0);

export type MediaKey = { key: Uint8Array; prefix: Uint8Array };
/** What the sealed text carries for an encrypted file. */
export type MediaSecret = { key: MediaKey; mime: string; fileName: string; sizeBytes: number; width?: number; height?: number; durationMs?: number; caption?: string };

export const createMediaKey = (): MediaKey => ({ key: randomBytes(KEY_BYTES), prefix: randomBytes(PREFIX_BYTES) });

function nonceOf(prefix: Uint8Array, index: number): Uint8Array {
  const nonce = new Uint8Array(PREFIX_BYTES + 4);
  nonce.set(prefix);
  new DataView(nonce.buffer).setUint32(PREFIX_BYTES, index);
  return nonce;
}

/** Seals chunk `index` (`last` for the final one, even when it is the only one). */
export const sealMediaChunk = (mediaKey: MediaKey, index: number, plain: Uint8Array, last: boolean): Uint8Array =>
  chacha20poly1305(mediaKey.key, nonceOf(mediaKey.prefix, index), last ? LAST : NOT_LAST).encrypt(plain);

/** Opens chunk `index`; throws when it was changed, moved or is not where it says. */
export const openMediaChunk = (mediaKey: MediaKey, index: number, sealed: Uint8Array, last: boolean): Uint8Array =>
  chacha20poly1305(mediaKey.key, nonceOf(mediaKey.prefix, index), last ? LAST : NOT_LAST).decrypt(sealed);

const chunkCount = (plainSize: number) => Math.max(1, Math.ceil(plainSize / MEDIA_CHUNK));

/** How big the encrypted file is: one tag per chunk. */
export const sealedMediaSize = (plainSize: number): number => plainSize + chunkCount(plainSize) * TAG_BYTES;

/** A whole file in memory (photos, and the tests); the app reads big files chunk by chunk with the two above. */
export function sealMediaFile(plain: Uint8Array, mediaKey: MediaKey): Uint8Array {
  const count = chunkCount(plain.length);
  const out = new Uint8Array(sealedMediaSize(plain.length));
  for (let index = 0; index < count; index += 1) {
    const sealed = sealMediaChunk(mediaKey, index, plain.subarray(index * MEDIA_CHUNK, (index + 1) * MEDIA_CHUNK), index === count - 1);
    out.set(sealed, index * (MEDIA_CHUNK + TAG_BYTES));
  }
  return out;
}

export function openMediaFile(sealed: Uint8Array, mediaKey: MediaKey): Uint8Array {
  const step = MEDIA_CHUNK + TAG_BYTES;
  const count = Math.max(1, Math.ceil(sealed.length / step));
  const parts: Uint8Array[] = [];
  for (let index = 0; index < count; index += 1) parts.push(openMediaChunk(mediaKey, index, sealed.subarray(index * step, (index + 1) * step), index === count - 1));
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const MARK = 'media';

/** The text that gets sealed end to end for an encrypted file. */
export function serializeMediaSecret(secret: MediaSecret): string {
  const { key, ...rest } = secret;
  return JSON.stringify({ lilachat: MARK, k: bytesToBase64(key.key), p: bytesToBase64(key.prefix), ...rest });
}

/** The media secret of an opened text, or `null` for an ordinary message. */
export function parseMediaSecret(text: string): MediaSecret | null {
  if (!text.startsWith('{')) return null;
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (raw.lilachat !== MARK || typeof raw.k !== 'string' || typeof raw.p !== 'string' || typeof raw.mime !== 'string') return null;
    const key = { key: base64ToBytes(raw.k), prefix: base64ToBytes(raw.p) };
    if (key.key.length !== KEY_BYTES || key.prefix.length !== PREFIX_BYTES) return null;
    const optional = (name: 'width' | 'height' | 'durationMs') => (typeof raw[name] === 'number' ? { [name]: raw[name] as number } : {});
    const caption = typeof raw.caption === 'string' && raw.caption ? { caption: raw.caption } : {};
    return { key, mime: raw.mime, fileName: typeof raw.fileName === 'string' ? raw.fileName : 'archivo', sizeBytes: Number(raw.sizeBytes) || 0, ...optional('width'), ...optional('height'), ...optional('durationMs'), ...caption };
  } catch {
    return null;
  }
}

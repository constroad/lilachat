import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Disco } from './disco.js';

/**
 * Lilachat's own media disk (pending 82, José 23/10: «ese producto es nuevo,
 * no tiene por qué usar nada de lila»). The root is `CHAT_STORAGE_ROOT`, the
 * marker is created once by hand (`npm run medios:init -w server`) and never
 * at boot: without the disk, a `mkdir` at boot would write on the startup disk
 * and the files would vanish from sight when the volume mounts on top
 * (`deploy-mini` §7.16).
 */
export const MEDIA_MARKER = '.lilachat-medios';
/** The public prefix of our files; lila's stay under `/files/`. */
export const MEDIA_PREFIX = '/media/';
/** Where clients reach us (a product fact); QA points it at the emulator. */
const PUBLIC_BASE = 'https://lilachat.constroad.com';
const SAFE_RELATIVE = /^[a-zA-Z0-9._/-]+$/;

export function mediaRoot(): string | null {
  return process.env.CHAT_STORAGE_ROOT || null;
}

export function mediaDisk(): Disco | null {
  const root = mediaRoot();
  return root ? new Disco(root, { marca: MEDIA_MARKER }) : null;
}

export function ownMediaBase(): string {
  return (process.env.CHAT_PUBLIC_URL || PUBLIC_BASE).replace(/\/$/, '');
}

/** A relative path inside the root, or null when it would leave it or has odd characters. */
export function safeRelative(relative: string): string | null {
  const clean = path.posix.normalize(relative).replace(/^\/+/, '');
  if (!clean || !SAFE_RELATIVE.test(clean) || clean.startsWith('..') || clean.split('/').some((part) => part.startsWith('.'))) return null;
  return clean;
}

/** The path inside our root of one of OUR media URLs (relative or absolute), or null for anyone else's. */
export function ownMediaRelative(url: string): string | null {
  const local = url.startsWith(ownMediaBase()) ? url.slice(ownMediaBase().length) : url;
  return local.startsWith(MEDIA_PREFIX) ? safeRelative(local.slice(MEDIA_PREFIX.length)) : null;
}

/** Our own file read from the disk instead of a round trip through the internet; null when it is not ours or not there. */
export async function readOwnMedia(url: string): Promise<Buffer | null> {
  const relative = ownMediaRelative(url);
  const root = mediaRoot();
  if (!relative || !root) return null;
  return readFile(path.join(root, relative)).catch(() => null);
}

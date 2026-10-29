import { MAX_BYTES_BY_KIND, sealedMediaSize, type MediaKind } from '@lilachat/shared';
import type { Message } from './chatModels.js';

/**
 * A photo, video, document or voice note of a secret chat (pending 67 / F12.3): the phone uploads it
 * already encrypted and sends, beside it, the end-to-end sealed text that
 * carries its key. The server only checks the shape of what it keeps: it
 * cannot read either of them. PURE.
 */
const SEALED_KINDS = ['image', 'video', 'audio', 'file'] as const;
type SealedKind = (typeof SEALED_KINDS)[number];
/** The sealed text holds a key, a type and a few numbers: far less than this. */
const MAX_SEALED_TEXT = 4000;

export type SealedUpload = { ok: true; envelope: NonNullable<Message['envelope']>; kind: SealedKind } | { ok: false; message: string };

const isSealedKind = (value: unknown): value is SealedKind => SEALED_KINDS.includes(value as SealedKind);
const isPart = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= MAX_SEALED_TEXT;

/** `null` for an ordinary upload (no envelope field). */
export function parseSealedUpload(body: Record<string, unknown> | undefined): SealedUpload | null {
  const raw = body?.envelope;
  if (raw === undefined || raw === '') return null;
  let envelope: Record<string, unknown> | null = null;
  try {
    envelope = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    envelope = null;
  }
  if (!envelope || envelope.v !== 1 || !isPart(envelope.nonce) || !isPart(envelope.ciphertext)) return { ok: false, message: 'El archivo cifrado llegó incompleto.' };
  if (!isSealedKind(body?.sealedKind)) return { ok: false, message: 'Ese tipo de archivo no va en un chat secreto.' };
  return { ok: true, envelope: { v: 1, nonce: envelope.nonce as string, ciphertext: envelope.ciphertext as string }, kind: body.sealedKind };
}

/** The same limit as the plain file, plus the tag of each encrypted chunk. */
export function sealedSizeProblem(sizeBytes: number, kind: MediaKind): string | null {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return 'El archivo está vacío.';
  return sizeBytes > sealedMediaSize(MAX_BYTES_BY_KIND[kind]) ? 'Ese archivo pesa demasiado.' : null;
}

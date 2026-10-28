import { createHmac, timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { ownMediaBase } from '../mediaDisk.js';
import { resolveJwtSecret } from '../sessions.js';

/**
 * The signed addresses an app reads files by: `https://<host>/api/bots/files/<token>`,
 * valid 15 minutes and on one fixed host (Inframaq allows only that one, against
 * SSRF). Two kinds: a form's photo (its record's id, R160) and a chat file sent
 * to the app (`m-` + the message id, pending 90: vouchers, receipts, invoices).
 */
const SIGNED_TTL_MS = 15 * 60_000;
const MESSAGE_PREFIX = 'm-';

export type SignedFile = { kind: 'form' | 'message'; id: string };

const signingKey = () => createHmac('sha256', resolveJwtSecret()).update('lilachat:bot-files').digest();
const signatureOf = (payload: string) => createHmac('sha256', signingKey()).update(payload).digest('base64url');

function signedAddress(ref: string, now: number): string {
  const payload = Buffer.from(`${ref}:${now + SIGNED_TTL_MS}`).toString('base64url');
  return `${ownMediaBase()}/api/bots/files/${payload}.${signatureOf(payload)}`;
}

export const signedFormFileUrl = (fileId: Types.ObjectId | string, now = Date.now()) => signedAddress(String(fileId), now);
export const signedMessageFileUrl = (messageId: Types.ObjectId | string, now = Date.now()) => signedAddress(`${MESSAGE_PREFIX}${messageId}`, now);

/** What a token points to: 404 for a forged or odd one, 410 once it expired. */
export function verifyFileToken(token: string, now = Date.now()): SignedFile | { status: 404 | 410 } {
  const [payload = '', signature = ''] = token.split('.');
  const expected = signatureOf(payload);
  if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return { status: 404 };
  const [ref = '', expires] = Buffer.from(payload, 'base64url').toString('utf8').split(':');
  const kind = ref.startsWith(MESSAGE_PREFIX) ? 'message' : 'form';
  const id = kind === 'message' ? ref.slice(MESSAGE_PREFIX.length) : ref;
  if (!Types.ObjectId.isValid(id)) return { status: 404 };
  if (Number(expires) < now) return { status: 410 };
  return { kind, id };
}

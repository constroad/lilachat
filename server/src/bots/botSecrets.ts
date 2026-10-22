import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The bots API's secrets (`specs/BOTS-API.spec.md`): each kind has its prefix
 * so a leaked one is recognizable (`lca_` client id, `lcx_` client secret,
 * `lcb_` bot token, `lcs_` signing secret). Only hashes are kept, except the
 * signing secret, which has to sign.
 */
const SECRET_BYTES = 32;
export const newSecret = (prefix: 'lca_' | 'lcx_' | 'lcb_' | 'lcs_' | 'lco_'): string => `${prefix}${randomBytes(SECRET_BYTES).toString('base64url')}`;

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Compares two hex hashes in constant time: a timing gap must not tell how much of a secret was right. */
export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** PKCE S256: BASE64URL(SHA256(code_verifier)) must be the challenge sent when authorizing. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (verifier.length < 43 || verifier.length > 128) return false;
  const computed = createHash('sha256').update(verifier).digest('base64url');
  const left = Buffer.from(computed);
  const right = Buffer.from(challenge);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** `v1=<hex>` of HMAC-SHA256(signing secret, "<timestamp>.<raw body>"), what agentes checks. */
export const eventSignature = (signingSecret: string, timestampMs: number, body: string): string =>
  `v1=${createHmac('sha256', signingSecret).update(`${timestampMs}.${body}`).digest('hex')}`;

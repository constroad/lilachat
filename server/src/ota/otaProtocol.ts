import { createVerify } from 'node:crypto';
import FormData from 'form-data';
import { serializeDictionary } from 'structured-headers';

/** A SHA-256 as base64url without padding: the name of an asset. */
export const ASSET_HASH = /^[A-Za-z0-9_-]{43}$/;
/** The `fingerprint` runtime is 40 hex characters; the pattern also keeps any value out of the path. */
export const RUNTIME_VERSION = /^[A-Za-z0-9._-]{1,128}$/;
const UPDATE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_ID = 'main';
/** The exact bytes that José's machine signs for «nothing newer» (`shared/src/otaPublish.ts` holds the same literal). */
export const NO_UPDATE_DIRECTIVE = '{"type":"noUpdateAvailable"}';

export const isUpdateId = (value: unknown): value is string => typeof value === 'string' && UPDATE_ID.test(value);

/** `sig="<base64>", keyid="main"`: the `expo-signature` header of a manifest or directive part. */
export function signatureHeader(signatureBase64: string): string {
  return serializeDictionary(
    new Map([
      ['sig', [signatureBase64, new Map()]],
      ['keyid', [KEY_ID, new Map()]],
    ])
  );
}

/** Whether `signatureBase64` signs exactly `payload` with the key behind `certificate` (RSA-SHA256, as expo-updates checks). */
export function isValidSignature(payload: string, signatureBase64: string, certificate: string): boolean {
  try {
    return createVerify('RSA-SHA256').update(payload, 'utf8').verify(certificate, signatureBase64, 'base64');
  } catch {
    return false;
  }
}

export type MultipartResponse = { body: Buffer; contentType: string };

function signedPart(form: FormData, name: 'manifest' | 'directive', payload: string, signature: string): void {
  form.append(name, payload, {
    contentType: 'application/json',
    header: { 'content-type': 'application/json; charset=utf-8', 'expo-signature': signatureHeader(signature) },
  });
}

/** Expo Updates protocol v1: the manifest part carries the stored string UNTOUCHED (the signature covers its bytes). */
export function manifestResponse(manifest: string, signature: string): MultipartResponse {
  const form = new FormData();
  signedPart(form, 'manifest', manifest, signature);
  form.append('extensions', JSON.stringify({ assetRequestHeaders: {} }), { contentType: 'application/json' });
  return { body: form.getBuffer(), contentType: `multipart/mixed; boundary=${form.getBoundary()}` };
}

/** `noUpdateAvailable` and `rollBackToEmbedded` travel as a signed `directive` part. */
export function directiveResponse(directive: string, signature: string): MultipartResponse {
  const form = new FormData();
  signedPart(form, 'directive', directive, signature);
  return { body: form.getBuffer(), contentType: `multipart/mixed; boundary=${form.getBoundary()}` };
}

export type ManifestSummary = { id: string; runtimeVersion: string; assetHashes: string[] };

/** What the server needs from a manifest it will not interpret otherwise; null when it is not one. */
export function summarizeManifest(text: string): ManifestSummary | null {
  try {
    const manifest = JSON.parse(text) as { id?: unknown; runtimeVersion?: unknown; launchAsset?: { hash?: unknown }; assets?: { hash?: unknown }[] };
    const hashes = [manifest.launchAsset?.hash, ...(manifest.assets ?? []).map((asset) => asset.hash)];
    if (!isUpdateId(manifest.id) || typeof manifest.runtimeVersion !== 'string') return null;
    if (!hashes.every((hash): hash is string => typeof hash === 'string' && ASSET_HASH.test(hash))) return null;
    return { id: manifest.id.toLowerCase(), runtimeVersion: manifest.runtimeVersion, assetHashes: [...new Set(hashes)] };
  } catch {
    return null;
  }
}

/** A rollback directive is the only other thing José's machine publishes as an update. */
export function isRollbackDirective(text: string): boolean {
  try {
    return (JSON.parse(text) as { type?: unknown }).type === 'rollBackToEmbedded';
  } catch {
    return false;
  }
}

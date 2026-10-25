import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * The PUBLIC certificate the phones trust for OTA updates (`app/certs/certificate.crt`, committed). The release
 * is a `git archive` of the whole repo, so the file travels with the server; where it sits relative to this code
 * depends on whether it runs bundled (`dist/index.js` at the release root) or from source (tests, `tsx`).
 * `OTA_CERTIFICATE_PATH` overrides both.
 */
const CANDIDATES = ['../app/certs/certificate.crt', '../../../app/certs/certificate.crt'];

let cached: string | null = null;

export async function otaCertificate(): Promise<string | null> {
  if (cached) return cached;
  const paths = [process.env.OTA_CERTIFICATE_PATH, ...CANDIDATES.map((relative) => fileURLToPath(new URL(relative, import.meta.url)))];
  for (const candidate of paths) {
    if (!candidate) continue;
    const text = await readFile(candidate, 'utf8').catch(() => null);
    if (text?.includes('BEGIN CERTIFICATE')) {
      cached = text;
      return text;
    }
  }
  return null;
}

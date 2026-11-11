import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ANIMATED_LOTTIE_VERSION, ANIMATED_PACK_ID, ANIMATED_STICKERS } from '@lilachat/shared';

/**
 * The pack's Lottie files are served `immutable` for a year, so a phone or a
 * browser that loaded one never asks again. On 11/11 the bear's «10» came out
 * cut and was fixed in the same file: whoever had the broken one would have
 * kept it. Regenerating the files must therefore bump ANIMATED_LOTTIE_VERSION
 * (it goes in the URL) and record the new fingerprint here.
 */
const RECORDED = { version: 2, sha256: '0043f7882f1378231146b4d0eefce268b2bbe42efd2ba73c4e3e144d0af8274f' };
const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'stickers', ANIMATED_PACK_ID);

function fingerprintOfFiles(): string {
  const hash = createHash('sha256');
  for (const name of readdirSync(FOLDER).filter((file) => file.endsWith('.json')).sort()) hash.update(name).update(readFileSync(join(FOLDER, name)));
  return hash.digest('hex');
}

describe('the Lottie files of the animated pack', () => {
  it('there is one beside every sticker of the pack', () => {
    const files = readdirSync(FOLDER).filter((file) => file.endsWith('.json')).sort();
    expect(files).toEqual(ANIMATED_STICKERS.map((sticker) => `${sticker.slug}.json`).sort());
  });

  it('a change in the files comes with a new version in their URL', () => {
    expect({ version: ANIMATED_LOTTIE_VERSION, sha256: fingerprintOfFiles() }, 'regenerated? bump ANIMATED_LOTTIE_VERSION and record the new sha256').toEqual(RECORDED);
  });
});

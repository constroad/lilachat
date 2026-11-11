import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Every screen that draws a sticker message draws it through `StickerArt`
 * (directly, or through `StickerMessage` / `StickerPair`). On 11/11 the Lottie
 * player was wired into the bubble only: channels (`FlatMessageRow`) and
 * threads (`HiloScreen`) kept their own `<Image>`, so in the APK the animated
 * pack still played the old WebP and a thread's sticker never stopped.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DRAWS_A_STICKER = /\.kind === 'sticker' && \w+\.media\?\.url/;
const THROUGH_THE_SHARED_PLAYER = /import \{[^}]*\b(StickerArt|StickerMessage|StickerPair)\b[^}]*\} from '\.{1,2}\/(stickers\/)?StickerMessage'/;

function sourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [path] : [];
  });
}

describe('sticker messages share one player (Lottie for the animated pack)', () => {
  it('finds the screens that draw sticker messages', () => {
    const drawing = sourceFiles(SRC).filter((file) => DRAWS_A_STICKER.test(readFileSync(file, 'utf8')));
    expect(drawing.map((file) => relative(SRC, file)).sort()).toEqual(['chat/FlatMessageRow.tsx', 'chat/HiloScreen.tsx', 'chat/MessageRow.tsx']);
  });

  it('every one of them draws the sticker through StickerArt', () => {
    const own = sourceFiles(SRC)
      .filter((file) => DRAWS_A_STICKER.test(readFileSync(file, 'utf8')))
      .filter((file) => !THROUGH_THE_SHARED_PLAYER.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));
    expect(own).toEqual([]);
  });
});

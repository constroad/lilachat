/**
 * Renders the animated sticker pack (backlog 31): each wink character doing
 * its dance, one loop, as an animated 512×512 WebP with a transparent
 * background, into `web/public/stickers/lila-mov/<slug>.webp`. The poses come
 * from `danceAt` (shared), the same steps the winks play; Chrome draws each
 * frame and `img2webp` (libwebp) joins them.
 *
 *   npx tsx web/scripts/render-animated-stickers.mts --playwright <node_modules/playwright-core> --chrome <chrome executable>
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ANIMATED_PACK_ID, ANIMATED_STICKERS, animatedStickerFrames, danceAt } from '../../shared/src/animatedStickers.ts';
import { DANCES } from '../../shared/src/winkDances.ts';
import { WINK_ART, type WinkArt, type WinkArtPart } from '../../shared/src/winkArt.ts';
import { STICKER_SIZE } from '../../shared/src/stickers.ts';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]!]] : pairs), []));
const { chromium } = await import(pathToFileURL(join(args.playwright!, 'index.mjs')).href);
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'web', 'public', 'stickers', ANIMATED_PACK_ID);

/** The character's drawing (viewBox units) and the air around it. */
const ART_WIDTH = 240;
const ART_HEIGHT = 320;
const MARGIN = 12;
/** The square around the character, tall enough for how high its dance jumps. */
function stageOf(dance: (typeof DANCES)[keyof typeof DANCES]): string {
  const jump = Math.max(0, ...(dance.whole?.y ?? [0]).map((y) => -y));
  const side = ART_HEIGHT + jump + MARGIN * 2;
  return `${(ART_WIDTH - side) / 2} ${-(jump + MARGIN)} ${side} ${side}`;
}
/** The middle of the character: the whole body turns around it. */
const CENTER = '120 160';
const WEBP_QUALITY = '60';
/** WhatsApp's own limit for an animated sticker. */
const MAX_BYTES = 500 * 1024;

type Pose = ReturnType<typeof danceAt>;

/** A part turned around its joint, with the parts that hang from it (eyes, mouth, what the hand holds). */
function drawPart(art: WinkArt, part: WinkArtPart, pose: Pose): string {
  const turn = (pose.parts as Record<string, number | undefined>)[part.part] ?? 0;
  const children = art.parts.filter((child) => child.parent === part.part).map((child) => drawPart(art, child, pose)).join('');
  return `<g transform="rotate(${turn.toFixed(2)} ${part.pivot[0]} ${part.pivot[1]})">${part.markup}${children}</g>`;
}

function frameSvg(art: WinkArt, pose: Pose, stage: string): string {
  const body = art.parts.filter((part) => !part.parent).map((part) => drawPart(art, part, pose)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${stage}" width="${STICKER_SIZE}" height="${STICKER_SIZE}">${art.defs ? `<defs>${art.defs}</defs>` : ''}<g transform="translate(${pose.whole.x.toFixed(2)} ${pose.whole.y.toFixed(2)}) rotate(${pose.whole.rotate.toFixed(2)} ${CENTER})">${body}</g></svg>`;
}

const browser = await chromium.launch({ executablePath: args.chrome, headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });
const work = mkdtempSync(join(tmpdir(), 'animated-stickers-'));
mkdirSync(out, { recursive: true });
try {
  for (const sticker of ANIMATED_STICKERS) {
    const art = WINK_ART[sticker.character];
    const dance = DANCES[sticker.dance];
    const moments = animatedStickerFrames(dance.loopMs);
    const frameMs = String(Math.round(dance.loopMs / moments.length));
    const frames: string[] = [];
    for (const [index, moment] of moments.entries()) {
      await page.setContent(`<html><body style="margin:0;background:transparent">${frameSvg(art, danceAt(dance, moment), stageOf(dance))}</body></html>`);
      const file = join(work, `${sticker.slug}-${String(index).padStart(3, '0')}.png`);
      await page.locator('svg').screenshot({ path: file, omitBackground: true });
      frames.push(file);
    }
    const target = join(out, `${sticker.slug}.webp`);
    execFileSync('img2webp', ['-loop', '0', '-lossy', '-q', WEBP_QUALITY, '-d', frameMs, ...frames, '-o', target]);
    const bytes = statSync(target).size;
    console.log(sticker.slug, `${frames.length} frames`, `${Math.round(bytes / 1024)} KB`, bytes > MAX_BYTES ? 'TOO BIG' : '');
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}

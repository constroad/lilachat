/**
 * Writes the animated pack as Lottie (José 11/11, like Telegram's stickers):
 * `web/public/stickers/lila-mov/<slug>.json` beside each WebP, which stays as
 * the fallback. The shapes come from the art's own SVG (`svgToLottieShapes`);
 * a part's text, which has no glyph outlines in the art, is drawn once by
 * Chrome as a PNG and hung on its part. With `--preview <file.png>`, Chrome
 * plays every file with lottie-web and saves a contact sheet of four moments
 * per sticker, to look at before publishing.
 *
 *   npx tsx web/scripts/render-lottie-stickers.mts --playwright <node_modules/playwright-core> --chrome <chrome executable> [--preview <file.png>]
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { ANIMATED_PACK_ID, ANIMATED_STICKERS } from '../../shared/src/animatedStickers.ts';
import { DANCES } from '../../shared/src/winkDances.ts';
import { WINK_ART, type WinkArt, type WinkArtPart } from '../../shared/src/winkArt.ts';
import { danceToLottie, type LottieAnimation, type PartImage } from '../../shared/src/lottie/rigToLottie.ts';
import { svgToLottieShapes } from '../../shared/src/lottie/svgToLottie.ts';

type Page = {
  setContent(html: string): Promise<void>;
  addScriptTag(options: { path: string }): Promise<unknown>;
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  screenshot(options: { clip?: { x: number; y: number; width: number; height: number }; omitBackground?: boolean; path?: string; fullPage?: boolean }): Promise<Buffer>;
};

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]!]] : pairs), []));
const { chromium } = await import(pathToFileURL(join(args.playwright!, 'index.mjs')).href);
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'web', 'public', 'stickers', ANIMATED_PACK_ID);

/** Pixels per viewBox unit of a text picture: a phone shows the sticker at ~480 px, about 1.5 per unit. */
const TEXT_PIXELS_PER_UNIT = 4;
/** Room around a text for its stroke, in viewBox units. */
const TEXT_PADDING = 3;
const PREVIEW_SHARES = [0, 0.25, 0.5, 0.75];
const PREVIEW_SIDE = 128;
/** Telegram's ceiling for a TGS sticker, gzipped. */
const TELEGRAM_MAX_GZIP = 64 * 1024;

/** Draws one part's text alone (everything else hidden) and cuts each text out as a PNG. */
async function textImagesOf(page: Page, art: WinkArt, part: WinkArtPart): Promise<PartImage[]> {
  if (!part.markup.includes('<text')) return [];
  const [, , width, height] = art.viewBox.split(/\s+/).map(Number);
  const hideShapes = '<style>svg :not(text):not(tspan):not(g):not(defs) { visibility: hidden }</style>';
  await page.setContent(`<html><body style="margin:0;background:transparent">${hideShapes}<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}" width="${width! * TEXT_PIXELS_PER_UNIT}" height="${height! * TEXT_PIXELS_PER_UNIT}">${art.defs ? `<defs>${art.defs}</defs>` : ''}${part.markup}</svg></body></html>`);
  const boxes = await page.evaluate(() => [...document.querySelectorAll('svg text')].map((text) => text.getBoundingClientRect()).map((box) => [box.x, box.y, box.width, box.height]), null);
  const pad = TEXT_PADDING * TEXT_PIXELS_PER_UNIT;
  const images: PartImage[] = [];
  for (const [index, [x, y, w, h]] of boxes.entries()) {
    const clip = { x: Math.max(0, Math.floor(x! - pad)), y: Math.max(0, Math.floor(y! - pad)), width: Math.ceil(w! + pad * 2), height: Math.ceil(h! + pad * 2) };
    const png = await page.screenshot({ clip, omitBackground: true });
    images.push({ id: `${part.part}-text-${index}`, dataUri: `data:image/png;base64,${png.toString('base64')}`, x: clip.x / TEXT_PIXELS_PER_UNIT, y: clip.y / TEXT_PIXELS_PER_UNIT, width: clip.width / TEXT_PIXELS_PER_UNIT, height: clip.height / TEXT_PIXELS_PER_UNIT, pixelsPerUnit: TEXT_PIXELS_PER_UNIT });
  }
  return images;
}

/** One sticker as Lottie: its shapes, its text pictures, and phase 2 on. */
async function stickerAnimation(page: Page, slug: string, art: WinkArt, dance: (typeof DANCES)[keyof typeof DANCES]): Promise<LottieAnimation> {
  const images = new Map<string, PartImage[]>();
  for (const part of art.parts) images.set(part.part, await textImagesOf(page, art, part));
  return danceToLottie({ name: slug, art, dance, shapesOf: (markup) => svgToLottieShapes(markup, { defs: art.defs }).shapes, imagesOf: (part) => images.get(part.part) ?? [] });
}

/** A grid: one row per sticker, one column per moment, each a lottie-web player stopped there. */
async function writePreview(page: Page, animations: LottieAnimation[], file: string): Promise<void> {
  await page.setContent(`<html><body style="margin:0;background:#f1f5f9"><div id="grid" style="display:grid;grid-template-columns:repeat(${PREVIEW_SHARES.length},${PREVIEW_SIDE}px);gap:4px;padding:4px"></div></body></html>`);
  await page.addScriptTag({ path: createRequire(import.meta.url).resolve('lottie-web/build/player/lottie_light.min.js') });
  await page.evaluate(({ list, shares, side }) => {
    type Player = { goToAndStop(frame: number, isFrame: boolean): void };
    const lottie = (window as unknown as { lottie: { loadAnimation(options: Record<string, unknown>): Player } }).lottie;
    const grid = document.getElementById('grid')!;
    for (const animation of list) {
      for (const share of shares) {
        const cell = document.createElement('div');
        cell.style.cssText = `width:${side}px;height:${side}px;background:#fff`;
        grid.appendChild(cell);
        lottie.loadAnimation({ container: cell, renderer: 'svg', loop: false, autoplay: false, animationData: animation }).goToAndStop(share * animation.op, true);
      }
    }
  }, { list: animations, shares: PREVIEW_SHARES, side: PREVIEW_SIDE });
  await page.screenshot({ path: file, fullPage: true });
}

const browser = await chromium.launch({ executablePath: args.chrome, headless: true });
const page: Page = await browser.newPage({ deviceScaleFactor: 1 });
try {
  const animations: LottieAnimation[] = [];
  for (const sticker of ANIMATED_STICKERS) {
    const animation = await stickerAnimation(page, sticker.slug, WINK_ART[sticker.character], DANCES[sticker.dance]);
    const json = JSON.stringify(animation);
    writeFileSync(join(out, `${sticker.slug}.json`), json);
    const gzip = gzipSync(json).length;
    console.log(sticker.slug, `${Math.round(json.length / 1024)} KB`, `gzip ${Math.round(gzip / 1024)} KB`, gzip > TELEGRAM_MAX_GZIP ? 'OVER TELEGRAM 64 KB' : '');
    animations.push(animation);
  }
  if (args.preview) await writePreview(page, animations, args.preview);
} finally {
  await browser.close();
}

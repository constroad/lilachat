/**
 * Checks the SVG → Lottie conversion of the wink art
 * (`shared/src/lottie/svgToLottie.ts`): every part of every character and
 * prop is drawn twice in headless Chrome — the original SVG and its Lottie
 * shapes through lottie-web (svg renderer, one static frame) — at 4× and
 * their pixels are compared, as a share of the pixels either one draws.
 * Prints the parts worst first and exits 1 when one goes past the limit.
 *
 * Columns: «converted» compares with the original minus what the converter
 * reports as skipped (text) — the converter's own error — counting a pixel
 * only when it is also out of the range the other image takes one pixel
 * around it: Chrome antialiases a native `<ellipse>` and the same ellipse as
 * Bézier curves differently (the original with its circles hand-written as
 * paths already differs 5 % pixel by pixel), so only what is more than a
 * pixel (¼ unit at 4×) from an edge counts. «strict» is pixel by pixel;
 * «all» is like «converted» against the whole original, text included.
 *
 *   npx tsx web/scripts/verify-lottie-parts.mts --playwright <node_modules/playwright-core> --chrome <chrome executable> [--scale 4] [--top 25] [--only piggy,amplifier] [--dump <folder> [--dump-over 0.01]]
 *
 * `--dump` writes the original, Lottie and diff (red) PNGs of every part past
 * the limit, or past `--dump-over <percent>`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LOTTIE_VERSION, type LottieShapeItem } from '../../shared/src/lottie/lottieJson.ts';
import { svgToLottieShapes } from '../../shared/src/lottie/svgToLottie.ts';
import { WINK_ART, WINK_PROPS, type WinkArt } from '../../shared/src/winkArt.ts';

type PartCase = { name: string; width: number; height: number; original: string; converted: string | null; animation: unknown; skipped: string[] };
type PartImages = { original: string; lottie: string; diff: string };
/** Percentages: `converted` and `strict` against the original minus what was skipped, `all` against the whole original. */
type PartComparison = { name: string; all: number; strict: number; converted: number; images?: PartImages };
type CompareRequest = { cases: Omit<PartCase, 'skipped'>[]; tolerance: number; dumpOver: number | null };
type LottiePlayer = { isLoaded: boolean; addEventListener(name: string, callback: () => void): void; goToAndStop(frame: number, isFrame: boolean): void; destroy(): void };
type LottieGlobal = { loadAnimation(options: { container: Element; renderer: 'svg'; loop: boolean; autoplay: boolean; animationData: unknown }): LottiePlayer };

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1] ?? '']] : pairs), []));
const SCALE = Number(args.scale ?? 4);
const TOP = Number(args.top ?? 25);
/** Percent of the drawn pixels (either image) that may differ. */
const MISMATCH_LIMIT = 1;
/** Premultiplied channel difference (of 255) below which two pixels are the same up to antialiasing. */
const CHANNEL_TOLERANCE = 32;
const BATCH_SIZE = 20;
const FRAME_RATE = 30;
/** What the converter skips, removed from the reference for the «converted» column. */
const SKIPPED_ELEMENTS = /<(text|style|image)\b[\s\S]*?<\/\1>/g;

function viewBoxOf(art: WinkArt): [number, number, number, number] {
  const [minX = 0, minY = 0, width = 0, height = 0] = art.viewBox.split(/[\s,]+/).map(Number);
  return [minX, minY, width, height];
}

function svgDocument(art: WinkArt, markup: string): string {
  const [, , width, height] = viewBoxOf(art);
  const defs = art.defs ? `<defs>${art.defs}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}" width="${width * SCALE}" height="${height * SCALE}">${defs}${markup}</svg>`;
}

const STILL = { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } };

/** One static frame, one shape layer holding the part's shapes (moved when the viewBox does not start at 0 0). */
function animationOf(art: WinkArt, shapes: LottieShapeItem[]): unknown {
  const [minX, minY, width, height] = viewBoxOf(art);
  const moved = { ty: 'tr', ...STILL, p: { a: 0, k: [-minX, -minY] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] } };
  const content = minX || minY ? [{ ty: 'gr', it: [...shapes, moved] }] : shapes;
  const layer = { ddd: 0, ind: 1, ty: 4, nm: 'part', sr: 1, ks: STILL, ao: 0, shapes: content, ip: 0, op: 1, st: 0, bm: 0 };
  return { v: LOTTIE_VERSION, fr: FRAME_RATE, ip: 0, op: 1, w: width, h: height, nm: 'part', ddd: 0, assets: [], layers: [layer] };
}

/** One part, ready to draw both ways: `character:piggy/head` (with `#index` when a character repeats a part name). */
function partCase(label: string, art: WinkArt, index: number): PartCase {
  const part = art.parts[index] ?? { part: 'body', markup: '' };
  const { shapes, skipped } = svgToLottieShapes(part.markup, { defs: art.defs });
  const [, , width, height] = viewBoxOf(art);
  const stripped = part.markup.replace(SKIPPED_ELEMENTS, '');
  const repeated = art.parts.filter((other) => other.part === part.part).length > 1;
  const name = `${label}/${part.part}${repeated ? `#${index}` : ''}`;
  const converted = stripped === part.markup ? null : svgDocument(art, stripped);
  return { name, width: width * SCALE, height: height * SCALE, original: svgDocument(art, part.markup), converted, animation: animationOf(art, shapes), skipped };
}

function partCases(): PartCase[] {
  const only = args.only ? new Set(args.only.split(',')) : null;
  const collections: [string, Record<string, WinkArt>][] = [['character', WINK_ART], ['prop', WINK_PROPS]];
  return collections.flatMap(([kind, arts]) =>
    Object.entries(arts)
      .filter(([id]) => !only || only.has(id))
      .flatMap(([id, art]) => art.parts.map((_, index) => partCase(`${kind}:${id}`, art, index))),
  );
}

/*
 * The functions named `inPage…` run IN THE PAGE: they are injected as text
 * (`Function.toString`), so they only use the DOM and each other.
 */

/** An SVG document drawn on a canvas, through an image like the app does. */
async function inPageDraw(svgText: string, width: number, height: number): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  await image.decode();
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
  return canvas;
}

/** The SVG lottie-web builds for the animation's first frame, sized like the original. */
async function inPageLottieSvg(animation: unknown, width: number, height: number): Promise<string> {
  const container = document.createElement('div');
  container.style.cssText = `width:${width}px;height:${height}px`;
  document.body.append(container);
  const player = (window as unknown as { lottie: LottieGlobal }).lottie.loadAnimation({ container, renderer: 'svg', loop: false, autoplay: false, animationData: animation });
  if (!player.isLoaded) await new Promise<void>((resolve) => player.addEventListener('DOMLoaded', resolve));
  player.goToAndStop(0, true);
  const svg = container.querySelector('svg');
  svg?.removeAttribute('style');
  svg?.setAttribute('width', String(width));
  svg?.setAttribute('height', String(height));
  const text = svg ? new XMLSerializer().serializeToString(svg) : '<svg xmlns="http://www.w3.org/2000/svg"/>';
  player.destroy();
  container.remove();
  return text;
}

function inPagePixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data ?? new Uint8ClampedArray();
}

/** The largest premultiplied channel (or alpha) difference between a pixel of one image and a pixel of the other, of 255. */
function inPagePixelDifference(one: Uint8ClampedArray, indexOne: number, two: Uint8ClampedArray, indexTwo: number): number {
  const [alphaOne, alphaTwo] = [one[indexOne + 3] ?? 0, two[indexTwo + 3] ?? 0];
  let difference = Math.abs(alphaOne - alphaTwo);
  for (let channel = 0; channel < 3; channel += 1) difference = Math.max(difference, Math.abs(((one[indexOne + channel] ?? 0) * alphaOne - (two[indexTwo + channel] ?? 0) * alphaTwo) / 255));
  return difference;
}

/** A pixel's premultiplied channels and alpha, 0–255. */
function inPagePremultiplied(image: Uint8ClampedArray, index: number): number[] {
  const alpha = image[index + 3] ?? 0;
  return [0, 1, 2].map((channel) => ((image[index + channel] ?? 0) * alpha) / 255).concat(alpha);
}

/**
 * True when `image`'s pixel lies within the range `other` takes one pixel
 * around it (± tolerance): an edge antialiased differently or drawn a hair
 * apart, not a shape that is missing, extra, moved or of another color.
 */
function inPageWithinNeighborhood(image: Uint8ClampedArray, other: Uint8ClampedArray, index: number, width: number, tolerance: number): boolean {
  const [x, y, height] = [(index / 4) % width, Math.floor(index / 4 / width), other.length / 4 / width];
  const [low, high] = [[255, 255, 255, 255], [0, 0, 0, 0]];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue;
      inPagePremultiplied(other, ((y + dy) * width + x + dx) * 4).forEach((value, channel) => {
        low[channel] = Math.min(low[channel] ?? value, value);
        high[channel] = Math.max(high[channel] ?? value, value);
      });
    }
  }
  return inPagePremultiplied(image, index).every((value, channel) => value >= (low[channel] ?? 0) - tolerance && value <= (high[channel] ?? 0) + tolerance);
}

/**
 * The share (%) of the pixels either image draws that differ past the
 * tolerance: `strict` pixel by pixel, `shape` only when the pixel is also
 * out of the other image's range around it (antialiasing aside); and which
 * ones differ that way.
 */
function inPageMismatch(first: HTMLCanvasElement, second: HTMLCanvasElement, tolerance: number): { strict: number; shape: number; differing: number[] } {
  const [one, two, width] = [inPagePixels(first), inPagePixels(second), first.width];
  const differing: number[] = [];
  let [covered, strict] = [0, 0];
  for (let index = 0; index < one.length; index += 4) {
    if ((one[index + 3] ?? 0) === 0 && (two[index + 3] ?? 0) === 0) continue;
    covered += 1;
    if (inPagePixelDifference(one, index, two, index) <= tolerance) continue;
    strict += 1;
    if (!inPageWithinNeighborhood(one, two, index, width, tolerance) || !inPageWithinNeighborhood(two, one, index, width, tolerance)) differing.push(index);
  }
  const percent = (count: number): number => (covered === 0 ? 0 : (count / covered) * 100);
  return { strict: percent(strict), shape: percent(differing.length), differing };
}

/** The original, faded, with the differing pixels in red. */
function inPageDiffImage(original: HTMLCanvasElement, differing: number[]): string {
  const canvas = Object.assign(document.createElement('canvas'), { width: original.width, height: original.height });
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.globalAlpha = 0.25;
  context.drawImage(original, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (const index of differing) image.data.set([255, 0, 0, 255], index);
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

async function inPageCompareParts(request: CompareRequest): Promise<PartComparison[]> {
  const comparisons: PartComparison[] = [];
  for (const part of request.cases) {
    const lottie = await inPageDraw(await inPageLottieSvg(part.animation, part.width, part.height), part.width, part.height);
    const original = await inPageDraw(part.original, part.width, part.height);
    const all = inPageMismatch(original, lottie, request.tolerance);
    const reference = part.converted ? await inPageDraw(part.converted, part.width, part.height) : original;
    const converted = part.converted ? inPageMismatch(reference, lottie, request.tolerance) : all;
    const dump = request.dumpOver !== null && converted.shape > request.dumpOver;
    const images = dump ? { original: original.toDataURL(), lottie: lottie.toDataURL(), diff: inPageDiffImage(reference, converted.differing) } : undefined;
    comparisons.push({ name: part.name, all: all.shape, strict: converted.strict, converted: converted.shape, images });
  }
  return comparisons;
}

const IN_PAGE_CODE = [inPageDraw, inPageLottieSvg, inPagePixels, inPagePixelDifference, inPagePremultiplied, inPageWithinNeighborhood, inPageMismatch, inPageDiffImage, inPageCompareParts].map(String).join('\n');

function dumpImages(folder: string, comparison: PartComparison): void {
  if (!comparison.images) return;
  mkdirSync(folder, { recursive: true });
  const base = comparison.name.replace(/[^\w-]+/g, '_');
  for (const [which, url] of Object.entries(comparison.images)) writeFileSync(join(folder, `${base}.${which}.png`), Buffer.from(url.split(',')[1] ?? '', 'base64'));
}

function report(cases: PartCase[], comparisons: PartComparison[]): number {
  const skippedOf = new Map(cases.map((part) => [part.name, part.skipped]));
  const worst = [...comparisons].sort((first, second) => second.converted - first.converted || second.strict - first.strict);
  const columns = (cells: string[]): string => cells.map((cell, index) => (index === 0 ? cell.padEnd(44) : cell.padStart(12))).join(' ');
  console.log(`${columns(['part', 'converted %', 'strict %', 'all %'])}  skipped`);
  for (const comparison of worst.slice(0, TOP)) {
    const skipped = skippedOf.get(comparison.name) ?? [];
    console.log(`${columns([comparison.name, ...[comparison.converted, comparison.strict, comparison.all].map((percent) => percent.toFixed(3))])}  ${skipped.join(', ')}`);
  }
  const failing = worst.filter((comparison) => comparison.converted > MISMATCH_LIMIT);
  const skippedParts = cases.filter((part) => part.skipped.length > 0).length;
  const worstOf = (read: (comparison: PartComparison) => number): string => Math.max(0, ...comparisons.map(read)).toFixed(3);
  console.log(`\n${comparisons.length} parts · ${failing.length} over ${MISMATCH_LIMIT} % (converted) · worst strict ${worstOf((comparison) => comparison.strict)} % · ${skippedParts} with skipped content, worst «all» ${worstOf((comparison) => comparison.all)} %`);
  return failing.length;
}

const { chromium } = await import(pathToFileURL(join(args.playwright ?? '', 'index.mjs')).href);
const lottiePlayer = createRequire(import.meta.url).resolve('lottie-web/build/player/lottie_svg.min.js');
const browser = await chromium.launch({ executablePath: args.chrome, headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent('<html><body style="margin:0"></body></html>');
  await page.addScriptTag({ path: lottiePlayer });
  // tsx names functions with `__name(...)` calls; in the page that helper does not exist.
  await page.addScriptTag({ content: `var __name = (target) => target;\n${IN_PAGE_CODE}\nwindow.compareParts = inPageCompareParts;` });
  const cases = partCases();
  const comparisons: PartComparison[] = [];
  for (let start = 0; start < cases.length; start += BATCH_SIZE) {
    const batch = cases.slice(start, start + BATCH_SIZE).map(({ skipped: _skipped, ...part }) => part);
    const request: CompareRequest = { cases: batch, tolerance: CHANNEL_TOLERANCE, dumpOver: args.dump ? Number(args['dump-over'] ?? MISMATCH_LIMIT) : null };
    comparisons.push(...((await page.evaluate((sent: CompareRequest) => (window as unknown as { compareParts: typeof inPageCompareParts }).compareParts(sent), request)) as PartComparison[]));
    process.stdout.write(`\r${comparisons.length}/${cases.length} parts`);
  }
  process.stdout.write('\n');
  if (args.dump) for (const comparison of comparisons) dumpImages(args.dump, comparison);
  process.exitCode = report(cases, comparisons) > 0 ? 1 : 0;
} finally {
  await browser.close();
}

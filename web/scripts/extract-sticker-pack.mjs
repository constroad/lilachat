/**
 * Builds the default sticker pack (`STICKER_PACKS` in shared/src/stickers.ts)
 * from the Stitch sheet `s1-pack-lila`: every `<svg data-sticker="<slug>">` is
 * rendered inside the original page (so its defs and fonts apply) to a 512×512
 * transparent WebP in `web/public/stickers/<pack>/`. Run once when the pack
 * changes; the WebP files are committed, so builds never download anything.
 *
 *   node web/scripts/extract-sticker-pack.mjs --sheet <sheet.html> \
 *     --playwright <node_modules/playwright-core> --chrome <chrome executable>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACK_ID = 'lila-1';
const SIDE = 512;
const WEBP_QUALITY = 0.92;

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []));
const { chromium } = await import(pathToFileURL(join(args.playwright, 'index.mjs')).href);
const output = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'stickers', PACK_ID);
mkdirSync(output, { recursive: true });

/** Runs in the page: shows only one sticker, at full size, over a transparent page. */
function isolate({ slug, side }) {
  document.getElementById('pack-render')?.remove();
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  for (const child of document.body.children) child.style.visibility = 'hidden';
  const clone = document.querySelector(`svg[data-sticker="${slug}"]`).cloneNode(true);
  clone.id = 'pack-render';
  clone.removeAttribute('class');
  clone.setAttribute('width', String(side));
  clone.setAttribute('height', String(side));
  Object.assign(clone.style, { position: 'fixed', left: '0', top: '0', width: `${side}px`, height: `${side}px`, visibility: 'visible', overflow: 'visible', zIndex: '99999' });
  document.body.appendChild(clone);
}

/** Runs in the page: the PNG screenshot re-encoded as WebP with its transparency. */
async function toWebp({ png, quality }) {
  const image = new Image();
  image.src = `data:image/png;base64,${png}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d').drawImage(image, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

const browser = await chromium.launch({ executablePath: args.chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(readFileSync(args.sheet, 'utf8'), { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const slugs = await page.$$eval('svg[data-sticker]', (all) => all.map((svg) => svg.getAttribute('data-sticker')));
for (const slug of slugs) {
  await page.evaluate(isolate, { slug, side: SIDE });
  const png = (await page.locator('#pack-render').screenshot({ omitBackground: true })).toString('base64');
  const bytes = await page.evaluate(toWebp, { png, quality: WEBP_QUALITY });
  writeFileSync(join(output, `${slug}.webp`), Buffer.from(bytes));
  console.log(`${slug}.webp ${(bytes.length / 1024).toFixed(1)} KB`);
}
await browser.close();

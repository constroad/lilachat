/**
 * Builds `shared/src/winkArt.ts` from the Stitch character sheets (José, 21/10:
 * winks are full-body characters that move their body). Every
 * `<svg data-wink="<id>">` holds its parts in `<g data-part>`; each part is
 * serialized with its computed colors inlined (outside the page its classes do
 * not apply) and gets its joint from its box: shoulder for the arms, hip for
 * the legs, neck for the head, root for the tail, feet for the body. Left and
 * right follow where each limb really is, whatever the sheet called it.
 *
 *   node web/scripts/extract-wink-art.mjs --sheets <a.html,b.html,c.html> \
 *     --playwright <node_modules/playwright-core> --chrome <chrome executable>
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []));
const { chromium } = await import(pathToFileURL(join(args.playwright, 'index.mjs')).href);
const output = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'shared', 'src', 'winkArt.ts');

/** Runs in the page: every character with its parts, colors inlined and boxes in viewBox units. */
function readCharacters() {
  const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule'];
  const SHAPES = 'path, circle, ellipse, rect, line, polyline, polygon';
  const inline = (root) => {
    for (const shape of [root, ...root.querySelectorAll(SHAPES)]) {
      if (!shape.matches?.(SHAPES)) continue;
      const style = getComputedStyle(shape);
      for (const prop of STYLE_PROPS) {
        const value = style.getPropertyValue(prop);
        // Plain numbers: react-native-svg does not read «3px».
        if (value && value !== 'normal') shape.setAttribute(prop, value.replace(/px$/, ''));
      }
      shape.removeAttribute('class');
      shape.removeAttribute('style');
    }
    root.removeAttribute('class');
  };
  return [...document.querySelectorAll('svg[data-wink]')].map((svg) => {
    const parts = [...svg.querySelectorAll('g[data-part]')].map((group) => {
      const box = group.getBBox();
      const clone = group.cloneNode(true);
      inline(clone);
      // getBBox is in the group's user space; a transform on the group itself is kept on the clone.
      return { part: group.getAttribute('data-part'), box: { x: box.x, y: box.y, width: box.width, height: box.height }, markup: clone.innerHTML.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim(), transform: group.getAttribute('transform') ?? '' };
    });
    const defs = svg.querySelector('defs');
    return { id: svg.getAttribute('data-wink'), viewBox: svg.getAttribute('viewBox') ?? '0 0 240 320', defs: defs ? defs.innerHTML.replace(/\s+/g, ' ').trim() : '', parts };
  });
}

/** The sheets of 21/10 used the emoji winks' ids; the characters have their own. */
const ID_IN_CATALOG = { hardhat: 'worker', coffee: 'cuppa', hearts: 'sweetheart', applause: 'bear', party: 'kitty', laugh: 'puppy', hug: 'panda', done: 'brick' };

const center = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** The joint each part turns around. */
function pivotOf(part, box, body) {
  const middle = center(box);
  if (part === 'body') return [middle.x, box.y + box.height];
  if (part === 'head') return [middle.x, box.y + box.height * 0.92];
  if (part.startsWith('leg')) return [middle.x, box.y + box.height * 0.08];
  if (part === 'tail') return middle.x > body.x ? [box.x, middle.y] : [box.x + box.width, middle.y];
  // An arm: its inner top corner, the shoulder.
  return middle.x < body.x ? [box.x + box.width * 0.85, box.y + box.height * 0.12] : [box.x + box.width * 0.15, box.y + box.height * 0.12];
}

/** «Left» is the viewer's left: a limb is named by where it is. */
function sideOf(part, box, body) {
  if (!part.startsWith('arm') && !part.startsWith('leg')) return part;
  const kind = part.startsWith('arm') ? 'arm' : 'leg';
  return center(box).x < body.x ? `${kind}-left` : `${kind}-right`;
}

const browser = await chromium.launch({ executablePath: args.chrome, headless: true, args: ['--disable-features=AudioServiceOutOfProcess'] });
const characters = [];
try {
  for (const sheet of args.sheets.split(',')) {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(sheet).href, { waitUntil: 'networkidle' });
    characters.push(...(await page.evaluate(readCharacters)));
    await page.close();
  }
} finally {
  await browser.close();
}

const art = {};
for (const character of characters) {
  const bodyPart = character.parts.find((part) => part.part === 'body');
  const body = bodyPart ? center(bodyPart.box) : { x: 120, y: 200 };
  art[ID_IN_CATALOG[character.id] ?? character.id] = {
    viewBox: character.viewBox,
    defs: character.defs,
    parts: character.parts.map((part) => {
      const name = sideOf(part.part, part.box, body);
      const [x, y] = pivotOf(name, part.box, body);
      return { part: name, pivot: [Math.round(x * 10) / 10, Math.round(y * 10) / 10], markup: part.transform ? `<g transform="${part.transform}">${part.markup}</g>` : part.markup };
    }),
  };
  console.log(character.id, character.parts.map((part) => part.part).join(','));
}

const header = `/**
 * GENERATED by \`web/scripts/extract-wink-art.mjs\` from the Stitch character
 * sheets (do not edit by hand). The wink characters: each part's SVG markup in
 * draw order and the joint it turns around, in viewBox units.
 */
import type { WinkPart } from './winkDances.js';
import type { WinkId } from './winks.js';

export type WinkArt = { viewBox: string; defs: string; parts: readonly { part: WinkPart; pivot: readonly [number, number]; markup: string }[] };

export const WINK_ART: Partial<Record<WinkId, WinkArt>> = `;
writeFileSync(output, `${header}${JSON.stringify(art, null, 2)};\n`);
console.log('written', output, Object.keys(art).length, 'characters');

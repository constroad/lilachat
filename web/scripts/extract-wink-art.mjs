/**
 * Builds `shared/src/winkArt.ts` from the Stitch sheets (José, 21/10: winks are
 * full-body characters that move their body, and each one a sketch with a
 * punchline). Every `<svg data-wink="<id>">` holds its parts in `<g data-part>`;
 * a part inside another one (the eyes and the mouth inside the head) is kept
 * apart with its `parent`, so it moves with it and also on its own (a wink, a
 * yawn). Every `<svg data-prop="<id>">` is a loose prop (the water balloon, the
 * STOP paddle). Each part is serialized with its computed colors inlined
 * (outside the page its classes do not apply) and gets its joint from its box:
 * shoulder for the arms, hip for the legs, neck for the head, root for the
 * tail, feet for the body, the middle for the face and the props. Left and
 * right follow where each limb really is, whatever the sheet called it. A later
 * sheet wins over an earlier one for the same character.
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

/** Runs in the page: every character and prop with its parts, colors inlined and boxes in viewBox units. */
function readSheet() {
  /** What a shape gets unless it says otherwise: only the rest is written (the file stays small). */
  const DEFAULTS = { fill: '#000000', stroke: 'none', 'stroke-width': '1', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', opacity: '1', 'fill-opacity': '1', 'stroke-opacity': '1', 'fill-rule': 'nonzero' };
  const TEXT_PROPS = ['font-family', 'font-size', 'font-weight', 'text-anchor', 'letter-spacing'];
  const SHAPES = 'path, circle, ellipse, rect, line, polyline, polygon, text';
  /** Something held in a hand that a sketch lets go of (the galán throws his rose). */
  const HELD = ['rosa-galan'];
  const hex = (value) => {
    const rgb = value.match(/^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/);
    if (!rgb) return value;
    if (rgb[4] === '0') return 'none';
    return `#${[rgb[1], rgb[2], rgb[3]].map((channel) => Number(channel).toString(16).padStart(2, '0')).join('')}`;
  };
  const inline = (root) => {
    for (const shape of root.querySelectorAll(SHAPES)) {
      const style = getComputedStyle(shape);
      const props = shape.matches('text') ? [...Object.keys(DEFAULTS), ...TEXT_PROPS] : Object.keys(DEFAULTS);
      for (const prop of props) {
        // Plain numbers: react-native-svg does not read «3px».
        const value = hex(style.getPropertyValue(prop).replace(/px$/, ''));
        if (!value || value === 'normal' || value === DEFAULTS[prop]) shape.removeAttribute(prop);
        else shape.setAttribute(prop, value);
      }
      shape.removeAttribute('class');
      shape.removeAttribute('style');
    }
    root.removeAttribute('class');
  };
  const clean = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
  const boxOf = (element) => {
    const box = element.getBBox();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  };
  const partsOf = (svg) => {
    for (const id of HELD) svg.querySelector(`g#${id}`)?.setAttribute('data-part', 'held');
    return [...svg.querySelectorAll('g[data-part]')].map((group) => {
      const parent = group.parentElement?.closest('g[data-part]');
      const clone = group.cloneNode(true);
      // A part inside this one is drawn on its own.
      clone.querySelectorAll('g[data-part]').forEach((inner) => inner.remove());
      return { part: group.getAttribute('data-part'), parent: parent?.getAttribute('data-part') ?? null, box: boxOf(group), markup: clean(clone.innerHTML), transform: group.getAttribute('transform') ?? '' };
    });
  };
  const defsOf = (svg) => clean(svg.querySelector('defs')?.innerHTML ?? '');
  // Computed styles exist only on the live page: inline them before cloning anything.
  document.querySelectorAll('svg[data-wink], svg[data-prop]').forEach(inline);
  const characters = [...document.querySelectorAll('svg[data-wink]')].map((svg) => ({ id: svg.getAttribute('data-wink'), viewBox: svg.getAttribute('viewBox') ?? '0 0 240 320', defs: defsOf(svg), parts: partsOf(svg) }));
  const props = [...document.querySelectorAll('svg[data-prop]')].map((svg) => {
    const defs = defsOf(svg);
    svg.querySelector('defs')?.remove();
    const clone = svg.cloneNode(true);
    return { id: svg.getAttribute('data-prop'), viewBox: svg.getAttribute('viewBox') ?? '0 0 200 200', defs, markup: clean(clone.innerHTML), box: boxOf(svg) };
  });
  return { characters, props };
}

/** The sheets of 21/10 used the emoji winks' ids; the characters have their own. */
const ID_IN_CATALOG = { hardhat: 'worker', coffee: 'cuppa', hearts: 'sweetheart', applause: 'bear', party: 'kitty', laugh: 'puppy', hug: 'panda', done: 'brick' };
const FACE = ['eye-left', 'eye-right', 'mouth', 'held'];

const center = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** The joint each part turns around. */
function pivotOf(part, box, body) {
  const middle = center(box);
  if (FACE.includes(part)) return [middle.x, middle.y];
  if (part === 'body') return [middle.x, box.y + box.height];
  if (part === 'head') return [middle.x, box.y + box.height * 0.92];
  if (part.startsWith('leg')) return [middle.x, box.y + box.height * 0.08];
  if (part === 'tail') return middle.x > body.x ? [box.x, middle.y] : [box.x + box.width, middle.y];
  // An arm: its inner top corner, the shoulder.
  return middle.x < body.x ? [box.x + box.width * 0.85, box.y + box.height * 0.12] : [box.x + box.width * 0.15, box.y + box.height * 0.12];
}

/** «Left» is the viewer's left: a limb or an eye is named by where it is. */
function sideOf(part, box, body) {
  const kind = ['arm', 'leg', 'eye'].find((prefix) => part.startsWith(`${prefix}-`));
  if (!kind) return part;
  return center(box).x < body.x ? `${kind}-left` : `${kind}-right`;
}

/** An eye alone (a head in profile) keeps its name. */
function namesOf(parts, body) {
  const eyes = parts.filter((part) => part.part.startsWith('eye-'));
  return parts.map((part) => (part.part.startsWith('eye-') && eyes.length < 2 ? part.part : sideOf(part.part, part.box, body)));
}

const round = (value) => Math.round(value * 10) / 10;

const browser = await chromium.launch({ executablePath: args.chrome, headless: true, args: ['--disable-features=AudioServiceOutOfProcess'] });
const characters = [];
const props = [];
try {
  for (const sheet of args.sheets.split(',')) {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(sheet).href, { waitUntil: 'networkidle' });
    const read = await page.evaluate(readSheet);
    characters.push(...read.characters);
    props.push(...read.props);
    await page.close();
  }
} finally {
  await browser.close();
}

const art = {};
for (const character of characters) {
  const bodyPart = character.parts.find((part) => part.part === 'body');
  const body = bodyPart ? center(bodyPart.box) : { x: 120, y: 200 };
  const names = namesOf(character.parts, body);
  // Seen from behind, the tail is on top of the body and turns around its root (Stitch drew it underneath).
  const fromBehind = character.id.endsWith('-back');
  // An empty group (a heart has no tail) is left out.
  const order = character.parts.map((_, index) => index).filter((index) => character.parts[index].markup);
  if (fromBehind) order.sort((a, b) => Number(character.parts[a].part === 'tail') - Number(character.parts[b].part === 'tail'));
  art[ID_IN_CATALOG[character.id] ?? character.id] = {
    viewBox: character.viewBox,
    defs: character.defs,
    parts: order.map((index) => {
      const part = character.parts[index];
      const name = names[index];
      const [x, y] = fromBehind && name === 'tail' ? [center(part.box).x, part.box.y + part.box.height] : pivotOf(name, part.box, body);
      const markup = part.transform ? `<g transform="${part.transform}">${part.markup}</g>` : part.markup;
      return { part: name, pivot: [round(x), round(y)], markup, ...(part.parent ? { parent: names[character.parts.findIndex((other) => other.part === part.parent)] ?? part.parent } : {}) };
    }),
  };
  console.log('character', character.id, character.parts.map((part) => (part.parent ? `${part.parent}>${part.part}` : part.part)).join(','));
}

const propArt = {};
for (const prop of props) {
  const middle = center(prop.box);
  propArt[prop.id] = { viewBox: prop.viewBox, defs: prop.defs, parts: [{ part: 'body', pivot: [round(middle.x), round(middle.y)], markup: prop.markup }] };
  console.log('prop', prop.id);
}

const union = (ids) => ids.map((id) => `'${id}'`).join(' | ');
const header = `/**
 * GENERATED by \`web/scripts/extract-wink-art.mjs\` from the Stitch sheets (do
 * not edit by hand). The wink characters and props: each part's SVG markup in
 * draw order, the joint it turns around (viewBox units) and, for a face part,
 * the part it rides on.
 */
import type { RigPart } from './winkTimeline.js';

export type WinkArtPart = { part: RigPart; pivot: readonly [number, number]; markup: string; parent?: RigPart };
export type WinkArt = { viewBox: string; defs: string; parts: readonly WinkArtPart[] };
export type WinkArtId = ${union(Object.keys(art))};
export type WinkPropId = ${union(Object.keys(propArt))};

export const WINK_ART: Record<WinkArtId, WinkArt> = `;
writeFileSync(output, `${header}${JSON.stringify(art, null, 2)};\n\nexport const WINK_PROPS: Record<WinkPropId, WinkArt> = ${JSON.stringify(propArt, null, 2)};\n`);
console.log('written', output, Object.keys(art).length, 'characters', Object.keys(propArt).length, 'props');

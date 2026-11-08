/**
 * Runs one step of a tutorial on the page: first the screen MOVES, then the caption and the voice
 * (skill tutorial-video-loop §3). A step that fails is narrated anyway and leaves a warning: losing
 * a whole recording for a button that moved is the worst trade.
 */
import { NARRATION_TAIL_MS, captionMs, voicedCaptionMs, type TutorialAction, type TutorialStep } from '@lilachat/shared';

/** The part of puppeteer's Page the recorder uses (puppeteer comes untyped from lila-app). */
export type RecorderPage = {
  evaluate: (expression: string) => Promise<unknown>;
  goto: (url: string, options: { waitUntil: string; timeout: number }) => Promise<unknown>;
  keyboard: { press: (key: string) => Promise<void>; type: (text: string, options: { delay: number }) => Promise<void>; down: (key: string) => Promise<void>; up: (key: string) => Promise<void> };
  mouse: { move: (x: number, y: number, options?: { steps: number }) => Promise<void>; down: () => Promise<void>; up: () => Promise<void>; click: (x: number, y: number, options: { delay: number }) => Promise<void> };
};

export type StepOutcome = { warning: string | null; spokeAt: number };
type Box = { x: number; y: number; width: number; height: number };

const SELECTOR_WAIT_MS = 25_000;
const POLL_MS = 400;
const GOTO_SETTLE_MS = 4000;
const MOVE_SETTLE_MS = 800;
const CLICK_SETTLE_MS = 1200;
const TYPE_DELAY_MS = 28;
const DRAG_STEPS = 24;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Calls the overlay inside the page with JSON arguments. */
export const overlay = (page: RecorderPage, method: string, ...args: unknown[]): Promise<unknown> =>
  page.evaluate(`window.__tutorial.${method}(${args.map((value) => JSON.stringify(value)).join(',')})`);

const boxOf = async (page: RecorderPage, selector: string): Promise<Box | null> =>
  (await page.evaluate(`(() => { const el = window.__tutorial.resolve(${JSON.stringify(selector)}); if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'auto' }); const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`)) as Box | null;

async function waitFor(page: RecorderPage, selector: string): Promise<boolean> {
  const deadline = Date.now() + SELECTOR_WAIT_MS;
  while (Date.now() < deadline) {
    if (await page.evaluate(`Boolean(window.__tutorial.resolve(${JSON.stringify(selector)}))`)) return true;
    await sleep(POLL_MS);
  }
  return false;
}

/** A real mouse click at the element's centre: the only one Radix menus open with. */
async function clickAt(page: RecorderPage, selector: string): Promise<boolean> {
  await overlay(page, 'pointAt', selector);
  await sleep(MOVE_SETTLE_MS);
  const box = await boxOf(page, selector);
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 40 });
  await sleep(CLICK_SETTLE_MS);
  return true;
}

/** Types key by key into a focused field and reads it back: typing into the wrong field gives no error. */
async function typeInto(page: RecorderPage, selector: string, text: string): Promise<string | null> {
  if (!(await clickAt(page, selector))) return `no encontró «${selector}»`;
  await page.keyboard.press('End');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Home');
  await page.keyboard.up('Shift');
  await page.keyboard.type(text, { delay: TYPE_DELAY_MS });
  const written = String(await page.evaluate(`(window.__tutorial.resolve(${JSON.stringify(selector)}) || {}).value || ''`));
  return written.trim() === text.trim() ? null : `escribió «${text}» y el campo quedó en «${written}»`;
}

/** The offset that takes `selector` a share of the way to `toward`, read on screen at that moment. */
async function offsetToward(page: RecorderPage, selector: string, toward: string, share: number): Promise<{ dx: number; dy: number } | null> {
  const [from, to] = [await boxOf(page, selector), await boxOf(page, toward)];
  if (!from || !to) return null;
  const centre = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  return { dx: (centre(to).x - centre(from).x) * share, dy: (centre(to).y - centre(from).y) * share };
}

async function dragBy(page: RecorderPage, selector: string, dx: number, dy: number): Promise<boolean> {
  await overlay(page, 'pointAt', selector);
  await sleep(MOVE_SETTLE_MS);
  const box = await boxOf(page, selector);
  if (!box) return false;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: DRAG_STEPS });
  await page.mouse.up();
  await sleep(CLICK_SETTLE_MS);
  return true;
}

/** A real click where a place falls on the map now on screen (the last ready one: the editor's or the board's). */
async function tapMap(page: RecorderPage, lat: number, lng: number): Promise<string | null> {
  const point = (await page.evaluate(`(() => { const holders = [...document.querySelectorAll('[data-testid="mapa-lienzo"]')].filter((el) => el.workMap);
    const el = holders[holders.length - 1]; if (!el) return null; const p = el.workMap.project([${lng}, ${lat}]); const r = el.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y }; })()`)) as { x: number; y: number } | null;
  if (!point) return 'no hay un mapa listo para tocar';
  await page.mouse.click(point.x, point.y, { delay: 40 });
  await sleep(CLICK_SETTLE_MS);
  return null;
}

async function highlight(page: RecorderPage, selector: string): Promise<boolean> {
  const found = Boolean(await overlay(page, 'scrollTo', selector));
  await sleep(MOVE_SETTLE_MS);
  if (found) await overlay(page, 'focus', selector);
  return found;
}

/** Moves the screen for one action; returns the warning, or null when it went fine. */
async function act(page: RecorderPage, action: TutorialAction, baseUrl: string): Promise<string | null> {
  if (action.kind === 'pause') return null;
  if (action.kind === 'goto') {
    await page.goto(`${baseUrl}${action.url}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await sleep(GOTO_SETTLE_MS);
    return null;
  }
  if (action.kind === 'press') {
    await page.keyboard.press(action.key);
    await sleep(CLICK_SETTLE_MS);
    return null;
  }
  if (action.kind === 'tapMap') return tapMap(page, action.lat, action.lng);
  if (!(await waitFor(page, action.selector))) return `no encontró «${action.selector}»`;
  if (action.kind === 'type') return typeInto(page, action.selector, action.text);
  if (action.kind === 'dragToward') {
    const offset = await offsetToward(page, action.selector, action.toward, action.share);
    return offset && (await dragBy(page, action.selector, offset.dx, offset.dy)) ? null : `no encontró «${action.toward}»`;
  }
  const done = action.kind === 'drag' ? await dragBy(page, action.selector, action.dx, action.dy)
    : action.kind === 'click' ? await clickAt(page, action.selector)
    : action.kind === 'hover' ? Boolean(await overlay(page, 'pointAt', action.selector))
    : await highlight(page, action.selector);
  return done ? null : `no encontró «${action.selector}»`;
}

/** `rehearsal` runs the script as an E2E: no voice, captions for a blink (skill §8). */
export type StepContext = { page: RecorderPage; baseUrl: string; progress: number; voiceMs: number; rehearsal: boolean };
const REHEARSAL_CAPTION_MS = 300;

/** One step: the action, then the caption for as long as the voice lasts. Never throws. */
export async function runStep(step: TutorialStep, context: StepContext): Promise<StepOutcome> {
  const { page } = context;
  let warning: string | null;
  try {
    warning = await act(page, step.action ?? { kind: 'pause' }, context.baseUrl);
    if (!warning && step.waitFor && !(await waitFor(page, step.waitFor))) warning = `no apareció «${step.waitFor}»`;
  } catch (error) {
    warning = `falló: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`;
  }
  await overlay(page, 'caption', step.say).catch(() => undefined);
  await overlay(page, 'progress', context.progress).catch(() => undefined);
  const spokeAt = Date.now();
  const onScreen = context.voiceMs ? voicedCaptionMs(context.voiceMs) + NARRATION_TAIL_MS : captionMs(step.say);
  await sleep(context.rehearsal ? REHEARSAL_CAPTION_MS : onScreen + (step.holdMs ?? 0));
  await overlay(page, 'blur').catch(() => undefined);
  await overlay(page, 'hideCursor').catch(() => undefined);
  return { warning, spokeAt };
}

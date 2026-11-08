/**
 * record.ts — records a client-channel tutorial, narrated, from its script in `guiones/`.
 *
 * Opens the app served by this same process (no crons) in a headless Chrome with a temporary
 * profile, runs the script with the caption layer on top, captures by CDP, makes the voice with
 * `say` and builds a WebM. Skill `tutorial-video-loop`; spec `specs/TUTORIALES-CANAL-CLIENTE.spec.md`.
 *
 *   npx tsx --env-file=.env scripts/tutorials/record.ts --guion=dibujar-calle --ensayo
 *   npx tsx --env-file=.env scripts/tutorials/record.ts --guion=dibujar-calle [--sin-audio] [--out=<dir>]
 *
 * Needs `web/dist` built (`npm run build --workspace=web`). Files land in `--out`, outside the repo.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { INTRO_CARD_MS, OUTRO_CARD_MS, validateTutorialScript, viewportOf, type TutorialScript } from '@lilachat/shared';
import { OVERLAY_SOURCE } from './overlay.js';
import { NARRATION_VOICE, buildNarrationTrack, encodeWebm, requireFromLila, synthesizeNarration, writeFrameList, type Frame, type Narration } from './media.js';
import { overlay, runStep, sleep, type RecorderPage } from './steps.js';
import { PROFILE_KEY, sessionFor, startLocalLilachat, type RecorderSession } from './session.js';

const SYSTEM_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCALE = 2;
const RECORDER_PORT = 4091;
const FIRST_LOAD_MS = 6000;
const QA_PHONE = '902049935';

const arg = (name: string, fallback = ''): string => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

async function loadScript(slug: string): Promise<TutorialScript> {
  const file = path.join(import.meta.dirname, 'guiones', `${slug}.ts`);
  if (!fs.existsSync(file)) throw new Error(`No existe el guion ${file}`);
  const loaded = (await import(pathToFileURL(file).href)) as { script: TutorialScript };
  return loaded.script;
}

type CdpFrame = { data: string; sessionId: number };
type Cdp = { on: (event: string, listener: (frame: CdpFrame) => void) => void; send: (method: string, params?: object) => Promise<unknown> };
type Request = { url: () => string; method: () => string; respond: (answer: object) => Promise<void>; continue: () => Promise<void> };
type Page = RecorderPage & {
  setViewport: (viewport: object) => Promise<void>;
  setRequestInterception: (on: boolean) => Promise<void>;
  on: (event: 'request', listener: (request: Request) => void) => void;
  evaluateOnNewDocument: (source: string) => Promise<unknown>;
  target: () => { createCDPSession: () => Promise<Cdp> };
  screenshot: (options: { path: string }) => Promise<unknown>;
};
type Browser = { newPage: () => Promise<Page>; close: () => Promise<void> };

async function startScreencast(page: Page, dir: string, width: number, height: number): Promise<{ frames: Frame[]; stop: () => Promise<unknown> }> {
  const client = await page.target().createCDPSession();
  const frames: Frame[] = [];
  client.on('Page.screencastFrame', (frame) => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(frame.data, 'base64'));
    frames.push({ file, at: Date.now() });
    void client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => undefined);
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: width * SCALE, maxHeight: height * SCALE, everyNthFrame: 1 });
  return { frames, stop: () => client.send('Page.stopScreencast').catch(() => undefined) };
}

/** The session answers the app's refresh; the install banner is already dismissed; dev noise is muted. */
async function preparePage(page: Page, session: RecorderSession, script: TutorialScript): Promise<void> {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/auth/session')) {
      void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ jwt: session.jwt, user: { name: session.profile.name ?? null } }) });
      return;
    }
    void request.continue();
  });
  await page.evaluateOnNewDocument(`try { localStorage.setItem(${JSON.stringify(PROFILE_KEY)}, ${JSON.stringify(JSON.stringify(session.profile))}); localStorage.setItem('lilachat.install-offer', JSON.stringify({ dismissals: 2, snoozeUntil: null })); localStorage.setItem('lilachat.iphone-guide-skipped', '1'); localStorage.setItem('lilachat.bienvenida-vista', '1'); localStorage.setItem('lilachat.avisoNotificaciones', String(Date.now()));${script.spaceId ? ` localStorage.setItem('lilachat.espacio', ${JSON.stringify(script.spaceId)});` : ''} } catch (e) {}`);
  await page.evaluateOnNewDocument(`${OVERLAY_SOURCE};
    window.addEventListener('unhandledrejection', (e) => e.preventDefault(), true);
    window.addEventListener('error', (e) => e.preventDefault(), true);
    document.addEventListener('DOMContentLoaded', () => window.__tutorial.cameraNames(${JSON.stringify(script.cameraNames ?? {})}));`);
}

/** The «Novedades» sheet greets every new version: it is closed before the camera rolls. */
async function dismissWhatsNew(page: Page): Promise<void> {
  if (await overlay(page, 'clickOn', 'boton:Entendido')) await sleep(800);
}

type Options = { baseUrl: string; outDir: string; voice: string | null; rehearsal: boolean };

async function runScript(page: Page, script: TutorialScript, narration: Narration[], options: Options): Promise<{ warnings: string[]; spokeAt: number[] }> {
  const warnings: string[] = [];
  const spokeAt: number[] = [];
  if (script.intro && !options.rehearsal) {
    await overlay(page, 'card', script.intro.title, script.intro.subtitle ?? '');
    await sleep(INTRO_CARD_MS);
    await overlay(page, 'hideCard');
    await sleep(600);
  }
  for (const [index, step] of script.steps.entries()) {
    const outcome = await runStep(step, { page, baseUrl: options.baseUrl, progress: (index + 1) / script.steps.length, voiceMs: narration[index]?.durationMs ?? 0, rehearsal: options.rehearsal });
    spokeAt.push(outcome.spokeAt);
    if (options.rehearsal) await page.screenshot({ path: path.join(options.outDir, `${script.slug}-paso-${String(index + 1).padStart(2, '0')}.png`) });
    if (outcome.warning) warnings.push(`Paso ${index + 1}: ${outcome.warning}`);
  }
  await overlay(page, 'hideCaption');
  await sleep(options.rehearsal ? 300 : OUTRO_CARD_MS);
  // Authoring aid (rehearsal only): `--evaluar=<expression>` prints what the page answers, e.g. a street's line.
  const probe = arg('evaluar');
  if (options.rehearsal && probe) console.log(JSON.stringify(await page.evaluate(probe)));
  return { warnings, spokeAt };
}

function writeOutputs(script: TutorialScript, frames: Frame[], narration: Narration[], spokeAt: number[], options: Options, workDir: string): { video: string; durationMs: number } {
  const frameList = writeFrameList(frames);
  const start = frames[0].at;
  const durationMs = frames[frames.length - 1].at - start + OUTRO_CARD_MS;
  let audio: string | null = null;
  if (options.voice) {
    audio = path.join(workDir, 'narration.opus');
    buildNarrationTrack(narration.map((clip, index) => ({ narration: clip, offsetMs: spokeAt[index] - start })), durationMs, audio);
  }
  const video = path.join(options.outDir, `${script.slug}.webm`);
  encodeWebm(frameList, audio, durationMs, video, viewportOf(script));
  const captions = script.steps.map((step, index) => ({ atMs: spokeAt[index] - start, text: step.say }));
  fs.writeFileSync(path.join(options.outDir, `${script.slug}.json`), JSON.stringify({ title: script.title, summary: script.summary, durationMs, sizeBytes: fs.statSync(video).size, captions }, null, 2));
  return { video, durationMs };
}

async function record(script: TutorialScript, session: RecorderSession, options: Options): Promise<string[]> {
  const puppeteer = requireFromLila<{ launch: (options: object) => Promise<Browser> }>('puppeteer');
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `tutorial-${script.slug}-`));
  fs.mkdirSync(options.outDir, { recursive: true });
  const narration = options.voice ? synthesizeNarration(script.steps, workDir, options.voice) : [];
  const { width, height } = viewportOf(script);
  const browser = await puppeteer.launch({ headless: 'new', executablePath: fs.existsSync(SYSTEM_CHROME) ? SYSTEM_CHROME : undefined, args: [`--window-size=${width},${height}`, '--force-color-profile=srgb'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: SCALE, isMobile: width < 768, hasTouch: false });
    await preparePage(page, session, script);
    await page.goto(`${options.baseUrl}${script.startUrl}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await sleep(FIRST_LOAD_MS);
    await dismissWhatsNew(page);
    const cast = options.rehearsal ? null : await startScreencast(page, workDir, width, height);
    const { warnings, spokeAt } = await runScript(page, script, narration, options);
    if (cast) {
      await cast.stop();
      const { video, durationMs } = writeOutputs(script, cast.frames, narration, spokeAt, options, workDir);
      console.log(`✅ ${video} — ${Math.floor(durationMs / 60000)}:${String(Math.round((durationMs % 60000) / 1000)).padStart(2, '0')}`);
    }
    return warnings;
  } finally {
    await browser.close();
    if (!flag('conservar')) fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  new Function(OVERLAY_SOURCE);
  const slug = arg('guion');
  if (!slug) throw new Error('Falta --guion=<slug> (mira scripts/tutorials/guiones/)');
  const script = await loadScript(slug);
  const check = validateTutorialScript(script);
  console.log(`🎬 ${script.title}: ${script.steps.length} pasos, estimado ${(check.durationMs / 60000).toFixed(1)} min`);
  if (!check.ok) {
    check.errors.forEach((error) => console.error(`   ✗ ${error}`));
    throw new Error('El guion no es grabable');
  }
  const server = await startLocalLilachat(RECORDER_PORT);
  try {
    const session = await sessionFor(arg('telefono', QA_PHONE));
    const rehearsal = flag('ensayo');
    const voice = rehearsal || flag('sin-audio') ? null : arg('voz', NARRATION_VOICE);
    const warnings = await record(script, session, { baseUrl: server.baseUrl, outDir: arg('out', path.join(os.tmpdir(), 'lilachat-tutorials')), voice, rehearsal });
    warnings.forEach((warning) => console.warn(`   ⚠ ${warning}`));
    console.log(warnings.length ? `${warnings.length} avisos: se leen hacia arriba (skill §7.4).` : 'Sin avisos.');
  } finally {
    await server.close();
  }
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  console.error('❌', error instanceof Error ? error.stack : error);
  process.exit(1);
});

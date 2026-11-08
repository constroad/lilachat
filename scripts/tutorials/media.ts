/**
 * Voice and video for the tutorial recorder: `say` (macOS) for the narration and ffmpeg for the
 * track and the WebM. `ffmpeg-static` and `puppeteer` are resolved from lila-app, which already has
 * them for its PDFs: Lilachat does not add 400 MB of Chromium for an authoring tool.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { encodeWidthOf, OUTRO_CARD_MS, type TutorialStep, type TutorialViewport } from '@lilachat/shared';

const LILA_ROOT = path.resolve(import.meta.dirname, '../../../lila-app');
/** Voice of `say`: Latin American Spanish with no marked accent (skill §3). */
export const NARRATION_VOICE = 'Paulina';
/** Words per minute: 168 sounds slow; José asked for an agile pace (20/10/2026). */
const NARRATION_RATE = 195;
const OUTPUT_FPS = 24;
/** Ceiling of each file, and how close to it the bitrate aims (VP9 with a target lands near, not exact). */
const MAX_BYTES = 4 * 1024 * 1024;
const TARGET_FILL = 0.88;
const AUDIO_KBPS = 32;
const ENCODE_ATTEMPTS = 3;

export function requireFromLila<T>(moduleName: string): T {
  const requireFromLilaApp = createRequire(path.join(LILA_ROOT, 'package.json'));
  try {
    return requireFromLilaApp(moduleName) as T;
  } catch {
    throw new Error(`Falta «${moduleName}» en ${LILA_ROOT}/node_modules: corre npm install en lila-app.`);
  }
}

const ffmpegPath = (): string => requireFromLila<string>('ffmpeg-static');

function runFfmpeg(args: string[], label: string): void {
  const run = spawnSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (run.status !== 0) throw new Error(`ffmpeg falló (${label})`);
}

export function probeDurationMs(file: string): number {
  const out = spawnSync(ffmpegPath(), ['-i', file], { encoding: 'utf8' }).stderr || '';
  const hit = out.match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/);
  if (!hit) throw new Error(`No se pudo leer la duración de ${file}`);
  const [, hours, minutes, seconds, centis] = hit.map(Number);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + centis * 10;
}

export type Narration = { file: string; durationMs: number };

/** The voice of each step is made BEFORE recording: its length decides how long the caption stays. */
export function synthesizeNarration(steps: TutorialStep[], dir: string, voice: string): Narration[] {
  return steps.map((step, index) => {
    const file = path.join(dir, `voice-${String(index).padStart(2, '0')}.aiff`);
    const said = spawnSync('say', ['-v', voice, '-r', String(NARRATION_RATE), '-o', file, step.say], { encoding: 'utf8' });
    if (said.status !== 0) throw new Error(`say falló con la voz «${voice}»: ${said.stderr || said.error?.message}`);
    return { file, durationMs: probeDurationMs(file) };
  });
}

export type Frame = { file: string; at: number };

/**
 * Frames arrive when the screen CHANGES, so each one lasts what it stayed on screen (concat
 * demuxer). The floor is a millisecond, not 1/fps: with 1/fps the bursts inflated the video past
 * the clock and `-shortest` cut the last 30 s of a Portal tutorial.
 */
export function writeFrameList(frames: Frame[]): string {
  if (frames.length < 2) throw new Error('No llegaron cuadros: ¿la página quedó en blanco?');
  const listFile = path.join(path.dirname(frames[0].file), 'frames.txt');
  const lines = frames.map((frame, index) => {
    const next = frames[index + 1];
    const seconds = next ? Math.max(0.001, (next.at - frame.at) / 1000) : OUTRO_CARD_MS / 1000;
    return `file '${frame.file}'\nduration ${seconds.toFixed(3)}`;
  });
  fs.writeFileSync(listFile, `${lines.join('\n')}\nfile '${frames[frames.length - 1].file}'\n`);
  return listFile;
}

/** The whole narration: silence as long as the video with each clip at the ms its caption appeared. */
export function buildNarrationTrack(clips: { narration: Narration; offsetMs: number }[], totalMs: number, outFile: string): void {
  const inputs = ['-f', 'lavfi', '-t', (totalMs / 1000).toFixed(3), '-i', 'anullsrc=r=24000:cl=mono'];
  clips.forEach((clip) => inputs.push('-i', clip.narration.file));
  const delays = clips.map((clip, index) => `[${index + 1}]adelay=${Math.max(0, Math.round(clip.offsetMs))}:all=1[v${index}]`).join(';');
  const mixInputs = ['[0]', ...clips.map((_, index) => `[v${index}]`)].join('');
  const filter = `${delays};${mixInputs}amix=inputs=${clips.length + 1}:normalize=0:duration=first[out]`;
  runFfmpeg([...inputs, '-filter_complex', filter, '-map', '[out]', '-ac', '1', outFile], 'narración');
}

/** WebM VP9 in two passes against a size budget: screen capture is text and still stretches. */
export function encodeWebm(frameList: string, audioFile: string | null, durationMs: number, outFile: string, viewport: TutorialViewport): void {
  const passLog = path.join(path.dirname(frameList), 'vp9pass');
  let videoKbps = Math.floor((MAX_BYTES * 8 * TARGET_FILL) / Math.max(1, durationMs / 1000) / 1000) - (audioFile ? AUDIO_KBPS : 0);
  for (let attempt = 1; attempt <= ENCODE_ATTEMPTS; attempt += 1) {
    const input = ['-f', 'concat', '-safe', '0', '-i', frameList];
    const video = ['-vf', `scale=${encodeWidthOf(viewport)}:-2,format=yuv420p`, '-r', String(OUTPUT_FPS), '-c:v', 'libvpx-vp9', '-b:v', `${videoKbps}k`, '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-passlogfile', passLog];
    runFfmpeg([...input, ...video, '-pass', '1', '-an', '-f', 'null', '/dev/null'], 'VP9 pasada 1');
    const audio = audioFile ? ['-i', audioFile] : [];
    const audioCodec = audioFile ? ['-c:a', 'libopus', '-b:a', `${AUDIO_KBPS}k`, '-shortest'] : ['-an'];
    runFfmpeg([...input, ...audio, ...video, '-pass', '2', ...audioCodec, outFile], 'VP9 pasada 2');
    const bytes = fs.statSync(outFile).size;
    if (bytes <= MAX_BYTES) return;
    videoKbps = Math.floor(videoKbps * (MAX_BYTES / bytes) * 0.9);
    console.warn(`   ⚠ quedó en ${(bytes / 1048576).toFixed(1)} MB, reintento a ${videoKbps} kbps`);
  }
  throw new Error(`No se pudo bajar de ${MAX_BYTES / 1048576} MB en ${ENCODE_ATTEMPTS} intentos`);
}

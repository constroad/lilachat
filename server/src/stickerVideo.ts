import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createSerialRunner, VIDEO_STICKER_MAX_MS } from '@lilachat/shared';

/**
 * A saved sticker as a short MP4 with its sound (José 27/11: «exportarlo para usarlo en WhatsApp»). WhatsApp takes no
 * sound from other apps; its own «Crear sticker» makes a sound sticker from a gallery video, so the video is the way in.
 * sharp reads each frame of the animated WebP (this ffmpeg cannot), on white, and ffmpeg joins them with the sound.
 */
const run = promisify(execFile);
const ffmpeg = () => process.env.FFMPEG_BIN || 'ffmpeg';
const EXPORT_TIMEOUT_MS = 60_000;
const SIDE = 512;
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
/** The mini is a Mac: when libx264 is missing, its own encoder; mpeg4 as the last resort. */
const ENCODERS = ['libx264', 'h264_videotoolbox', 'mpeg4'] as const;
const oneAtATime = createSerialRunner();

export type StickerVideoMaker = (input: { picture: Buffer; sound: Buffer | null }) => Promise<Buffer | null>;
type Frame = { file: string; ms: number };

const seconds = (ms: number) => (ms / 1000).toFixed(3);

/** ffmpeg's concat list: each frame for its time; the last one again, or ffmpeg drops its duration. */
export function frameListOf(frames: readonly Frame[]): string {
  const lines = frames.flatMap((frame) => [`file '${frame.file}'`, `duration ${seconds(frame.ms)}`]);
  const last = frames.at(-1);
  return [...lines, ...(last ? [`file '${last.file}'`] : [])].join('\n');
}

/** The frames + the sound → an MP4 of the given length; a still with sound ends with the sound. */
export function stickerVideoArgs(input: { list: string; sound: string | null; lengthMs: number; still: boolean; encoder: string; target: string }): string[] {
  const sound = input.sound ? ['-i', input.sound] : [];
  const audio = input.sound ? ['-c:a', 'aac', '-b:a', '96k', ...(input.still ? ['-shortest'] : [])] : ['-an'];
  return ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', input.list, ...sound, '-t', seconds(input.lengthMs), '-vf', 'fps=25,format=yuv420p', '-c:v', input.encoder, ...audio, '-movflags', '+faststart', input.target];
}

/** Each frame of the sticker on white (a video has no transparency), with how long it shows. */
async function framesOf(picture: Buffer, folder: string): Promise<Frame[]> {
  const { default: sharp } = await import('sharp');
  const metadata = await sharp(picture, { animated: true }).metadata();
  const pages = metadata.pages ?? 1;
  const frames: Frame[] = [];
  for (let page = 0; page < pages; page += 1) {
    const file = join(folder, `f${String(page).padStart(3, '0')}.png`);
    await sharp(picture, { page }).resize(SIDE, SIDE, { fit: 'contain', background: WHITE }).flatten({ background: WHITE }).png().toFile(file);
    frames.push({ file, ms: pages > 1 ? (metadata.delay?.[page] ?? 80) : VIDEO_STICKER_MAX_MS });
  }
  return frames;
}

async function encode(args: (encoder: string) => string[]): Promise<boolean> {
  for (const encoder of ENCODERS) {
    const done = await run(ffmpeg(), args(encoder), { timeout: EXPORT_TIMEOUT_MS }).then(() => true, () => false);
    if (done) return true;
  }
  return false;
}

/** The real maker, one at a time (the mini serves every app). Null when the picture cannot be read. */
export const stickerToVideo: StickerVideoMaker = ({ picture, sound }) =>
  oneAtATime(async () => {
    const folder = await mkdtemp(join(tmpdir(), 'sticker-video-'));
    try {
      const frames = await framesOf(picture, folder).catch(() => null);
      if (!frames?.length) return null;
      const [list, soundPath, target] = ['frames.txt', 'sound.in', 'sticker.mp4'].map((name) => join(folder, name)) as [string, string, string];
      await writeFile(list, frameListOf(frames));
      if (sound) await writeFile(soundPath, sound);
      const still = frames.length === 1;
      const lengthMs = Math.min(VIDEO_STICKER_MAX_MS, frames.reduce((sum, frame) => sum + frame.ms, 0));
      const made = await encode((encoder) => stickerVideoArgs({ list, sound: sound ? soundPath : null, lengthMs, still, encoder, target }));
      return made ? await readFile(target) : null;
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

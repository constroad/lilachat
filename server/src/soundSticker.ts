import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createSerialRunner, VIDEO_STICKER_MAX_MS, type ClipWindow } from '@lilachat/shared';
import { gifToAnimatedSticker } from './animatedSticker.js';

/**
 * A sticker with sound from a video (José 26/11, designs ss-01…ss-04). ffmpeg
 * cuts the clip into a GIF (this machine's ffmpeg has no WebP encoder) and
 * sharp turns it into the same 512×512 animated WebP as a GIF sticker. The
 * sound is cut apart as a small mono AAC file that plays next to it.
 */
const run = promisify(execFile);
const ffmpeg = () => process.env.FFMPEG_BIN || 'ffmpeg';
/** A 6-second clip renders in a few seconds on the mini; a minute is the ceiling. */
const CONVERT_TIMEOUT_MS = 60_000;
/** 80 ms per frame, which a GIF stores exactly (in hundredths): 6 s are 75 frames and the picture keeps time with the sound. */
const STICKER_FPS = 12.5;
const STICKER_SIDE = 512;
const AUDIO_BITRATE = '64k';
/** Smaller than this is an empty file: the input had no sound. */
const MIN_AUDIO_BYTES = 256;
const oneAtATime = createSerialRunner();

const seconds = (ms: number) => (ms / 1000).toFixed(3);

/** The video clip → a GIF of 512 px at most per side, with its own palette (no banding). */
export function videoClipToGifArgs(source: string, target: string, window: ClipWindow): string[] {
  const fit = `scale=${STICKER_SIDE}:${STICKER_SIDE}:force_original_aspect_ratio=decrease`;
  const filter = `fps=${STICKER_FPS},${fit},split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse`;
  return ['-y', '-loglevel', 'error', '-ss', seconds(window.startMs), '-t', seconds(window.durationMs), '-i', source, '-filter_complex', filter, '-an', '-loop', '0', target];
}

/** A clip of a file's sound → mono AAC. With no window it keeps the first 6 seconds (a recorded or uploaded sound). */
export function audioClipArgs(source: string, target: string, window: ClipWindow | null): string[] {
  const cut = window ? ['-ss', seconds(window.startMs), '-t', seconds(window.durationMs)] : ['-t', seconds(VIDEO_STICKER_MAX_MS)];
  return ['-y', '-loglevel', 'error', ...cut, '-i', source, '-map', '0:a:0?', '-vn', '-ac', '1', '-c:a', 'aac', '-b:a', AUDIO_BITRATE, '-movflags', '+faststart', target];
}

export type VideoStickerParts = { webp: Buffer; audio: Buffer | null };
export type VideoStickerRefusal = 'too-heavy' | 'not-a-video';
/** What the route needs: the clip's sticker and, when asked, a sound cut from the video or from a file. */
export type VideoStickerConverter = (input: { video: Buffer; window: ClipWindow; soundFrom: 'video' | Buffer | null }) => Promise<VideoStickerParts | VideoStickerRefusal>;

async function audioOf(folder: string, source: string, window: ClipWindow | null): Promise<Buffer | null> {
  const target = join(folder, 'sound.m4a');
  // A video with no sound track ends with no output: the sticker stays silent.
  const made = await run(ffmpeg(), audioClipArgs(source, target, window), { timeout: CONVERT_TIMEOUT_MS }).then(() => true, () => false);
  const size = made ? await stat(target).then((info) => info.size, () => 0) : 0;
  return size >= MIN_AUDIO_BYTES ? readFile(target) : null;
}

/** How long one loop of the animated WebP lasts, never more than the asked window. */
async function stickerLengthMs(webp: Buffer, windowMs: number): Promise<number> {
  const { default: sharp } = await import('sharp');
  const delays = (await sharp(webp, { animated: true }).metadata()).delay ?? [];
  const total = delays.reduce((sum, delay) => sum + delay, 0);
  return total > 0 ? Math.min(total, windowMs) : windowMs;
}

/** The real converter, one at a time: the mini serves every app. */
export const videoToSoundSticker: VideoStickerConverter = ({ video, window, soundFrom }) =>
  oneAtATime(async () => {
    const folder = await mkdtemp(join(tmpdir(), 'sound-sticker-'));
    try {
      const [source, gif, soundSource] = ['clip.mp4', 'clip.gif', 'sound.in'].map((name) => join(folder, name)) as [string, string, string];
      await writeFile(source, video);
      const cut = await run(ffmpeg(), videoClipToGifArgs(source, gif, window), { timeout: CONVERT_TIMEOUT_MS }).then(() => true, () => false);
      if (!cut) return 'not-a-video';
      const webp = await gifToAnimatedSticker(await readFile(gif));
      if (webp === 'not-an-image') return 'not-a-video';
      if (webp === 'too-heavy') return 'too-heavy';
      if (soundFrom === null) return { webp, audio: null };
      if (soundFrom === 'video') return { webp, audio: await audioOf(folder, source, window) };
      await writeFile(soundSource, soundFrom);
      // A GIF shorter than 6 s: the chosen sound is cut to the sticker's own length, so both loop together.
      return { webp, audio: await audioOf(folder, soundSource, { startMs: 0, durationMs: await stickerLengthMs(webp, window.durationMs) }) };
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

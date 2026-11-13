import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { createSerialRunner, type Timemark } from '@lilachat/shared';
import { timemarkSvg, type StampLogo } from './bots/photoStamp.js';

const run = promisify(execFile);
const ffmpeg = () => process.env.FFMPEG_BIN || 'ffmpeg';
const ffprobe = () => process.env.FFPROBE_BIN || 'ffprobe';
const PROBE_TIMEOUT_MS = 15_000;
/** A 3-minute 720p clip at `veryfast` takes well under a minute on the mini. */
const BURN_TIMEOUT_MS = 240_000;
const QUARTER_TURN = 90;
const HALF_TURN = 180;
/** One video at a time: the mini serves every app. */
const oneAtATime = createSerialRunner();

export type VideoSize = { width: number; height: number };
type ProbeStream = { width?: number; height?: number; side_data_list?: { rotation?: number }[]; tags?: { rotate?: string } };

/** ffprobe's answer → the size as it is SEEN: a phone records sideways and flags the turn. */
export function displaySizeOf(probe: unknown): VideoSize | null {
  const stream = (probe as { streams?: ProbeStream[] } | null)?.streams?.[0];
  if (!stream?.width || !stream.height) return null;
  const turn = Number(stream.side_data_list?.find((side) => side.rotation !== undefined)?.rotation ?? stream.tags?.rotate ?? 0);
  const sideways = Math.abs(turn) % HALF_TURN === QUARTER_TURN;
  return sideways ? { width: stream.height, height: stream.width } : { width: stream.width, height: stream.height };
}

async function probeSize(file: string): Promise<VideoSize | null> {
  const { stdout } = await run(ffprobe(), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_tags=rotate:stream_side_data=rotation', '-of', 'json', file], { timeout: PROBE_TIMEOUT_MS });
  return displaySizeOf(JSON.parse(stdout));
}

/**
 * The stamp of a photo burned into a video (José 12/11, design cam-05), in the same pass that
 * compresses it: ffmpeg turns it upright, lays the stamp the size of the frame over it and encodes
 * it once (H.264, 3 Mbps at most, `faststart` so it plays while it downloads). Null when the bytes
 * are not a video or the machine has no ffmpeg: the caller sends the video as it came.
 */
export function stampVideo(bytes: Buffer, stamp: Timemark, logo: StampLogo): Promise<Buffer | null> {
  return oneAtATime(async () => {
    const folder = await mkdtemp(join(tmpdir(), 'video-stamp-'));
    try {
      const [source, overlay, target] = ['in.mp4', 'stamp.png', 'out.mp4'].map((name) => join(folder, name)) as [string, string, string];
      await writeFile(source, bytes);
      const size = await probeSize(source);
      if (!size) return null;
      await sharp(timemarkSvg(size.width, size.height, stamp, logo)).png().toFile(overlay);
      await run(ffmpeg(), ['-y', '-loglevel', 'error', '-i', source, '-i', overlay, '-filter_complex', '[0:v][1:v]overlay=0:0,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-maxrate', '3M', '-bufsize', '6M', '-c:a', 'copy', '-movflags', '+faststart', target], { timeout: BURN_TIMEOUT_MS });
      return await readFile(target);
    } catch (error) {
      console.warn('[media] video sin sello:', error instanceof Error ? error.message.slice(0, 200) : error);
      return null;
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
}

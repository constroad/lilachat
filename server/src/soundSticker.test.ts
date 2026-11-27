import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { audioClipArgs, videoClipToGifArgs, videoToSoundSticker } from './soundSticker.js';

/** José 26/11: stickers with sound from a video, like WhatsApp's of 25/11. */
describe('videoClipToGifArgs', () => {
  it('cuts the asked window before reading the video and drops the sound', () => {
    // Act
    const args = videoClipToGifArgs('in.mp4', 'out.gif', { startMs: 12_000, durationMs: 6_000 });
    // Assert
    expect(args.slice(args.indexOf('-ss'), args.indexOf('-i'))).toEqual(['-ss', '12.000', '-t', '6.000']);
    expect(args).toContain('-an');
    expect(args.at(-1)).toBe('out.gif');
  });

  it('fits the picture in 512 px at 12.5 frames per second (80 ms, exact in a GIF)', () => {
    const filter = videoClipToGifArgs('in.mp4', 'out.gif', { startMs: 0, durationMs: 1_000 }).find((arg) => arg.includes('palettegen'))!;
    expect(filter).toContain('fps=12.5');
    expect(filter).toContain('scale=512:512:force_original_aspect_ratio=decrease');
  });
});

describe('audioClipArgs', () => {
  it('the video sound is cut at the same window, mono AAC', () => {
    const args = audioClipArgs('in.mp4', 'out.m4a', { startMs: 1_500, durationMs: 4_000 });
    expect(args.slice(args.indexOf('-ss'), args.indexOf('-i'))).toEqual(['-ss', '1.500', '-t', '4.000']);
    expect(args).toEqual(expect.arrayContaining(['-vn', '-ac', '1', '-c:a', 'aac']));
    // A video with no sound track ends with no output instead of an error that hides other ones.
    expect(args).toEqual(expect.arrayContaining(['-map', '0:a:0?']));
  });

  it('a recorded or uploaded sound keeps its first 6 seconds', () => {
    const args = audioClipArgs('voice.webm', 'out.m4a', null);
    expect(args).not.toContain('-ss');
    expect(args.slice(args.indexOf('-t'), args.indexOf('-t') + 2)).toEqual(['-t', '6.000']);
  });
});

describe('videoToSoundSticker (ffmpeg + sharp)', () => {
  const run = promisify(execFile);
  let folder: string;
  let withSound: Buffer;
  let silent: Buffer;

  const makeVideo = async (name: string, sound: boolean) => {
    const target = join(folder, name);
    const inputs = ['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=8', ...(sound ? ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=8'] : [])];
    await run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...(sound ? ['-c:a', 'aac'] : []), '-shortest', target]);
    return readFile(target);
  };

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), 'sound-sticker-test-'));
    [withSound, silent] = await Promise.all([makeVideo('sound.mp4', true), makeVideo('silent.mp4', false)]);
  }, 60_000);
  afterAll(() => rm(folder, { recursive: true, force: true }));

  it('a 6 s clip becomes a 512 animated WebP of 75 frames and its sound', async () => {
    const { default: sharp } = await import('sharp');
    // Act
    const made = await videoToSoundSticker({ video: withSound, window: { startMs: 1_000, durationMs: 6_000 }, soundFrom: 'video' });
    // Assert
    if (typeof made === 'string') throw new Error(made);
    const metadata = await sharp(made.webp, { animated: true }).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 512, pageHeight: 512, pages: 75 });
    expect(made.webp.length).toBeLessThanOrEqual(500 * 1024);
    expect(made.audio?.length).toBeGreaterThan(1_000);
    expect(made.audio!.subarray(4, 8).toString()).toBe('ftyp');
  }, 60_000);

  it('a video without a sound track stays silent instead of failing', async () => {
    const made = await videoToSoundSticker({ video: silent, window: { startMs: 0, durationMs: 2_000 }, soundFrom: 'video' });
    if (typeof made === 'string') throw new Error(made);
    expect(made.audio).toBeNull();
  }, 60_000);

  it('the sound can come from another file, cut at 6 seconds', async () => {
    const made = await videoToSoundSticker({ video: silent, window: { startMs: 0, durationMs: 1_000 }, soundFrom: withSound });
    if (typeof made === 'string') throw new Error(made);
    expect(made.audio?.length).toBeGreaterThan(1_000);
  }, 60_000);

  it('bytes that are not a video are refused', async () => {
    expect(await videoToSoundSticker({ video: Buffer.from('not a video'), window: { startMs: 0, durationMs: 1_000 }, soundFrom: null })).toBe('not-a-video');
  }, 60_000);
});

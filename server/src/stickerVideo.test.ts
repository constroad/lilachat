import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gifToAnimatedSticker } from './animatedSticker.js';
import { frameListOf, stickerToVideo, stickerVideoArgs } from './stickerVideo.js';

/** José 27/11: a saved sticker exported as a video with its sound, for WhatsApp's own «Crear sticker». */
describe('frameListOf', () => {
  it('each frame for its time, and the last one again so ffmpeg keeps its duration', () => {
    expect(frameListOf([{ file: '/t/f000.png', ms: 80 }, { file: '/t/f001.png', ms: 120 }])).toBe("file '/t/f000.png'\nduration 0.080\nfile '/t/f001.png'\nduration 0.120\nfile '/t/f001.png'");
  });
});

describe('stickerVideoArgs', () => {
  const base = { list: 'l.txt', lengthMs: 2_000, encoder: 'libx264', target: 'o.mp4' };
  it('an animated one with sound loops its picture for the given length, with the sound beside it', () => {
    const args = stickerVideoArgs({ ...base, sound: 's.m4a', still: false });
    expect(args.slice(args.indexOf('-t'), args.indexOf('-t') + 2)).toEqual(['-t', '2.000']);
    expect(args.slice(0, args.indexOf('-f'))).toEqual(expect.arrayContaining(['-stream_loop', '-1']));
    expect(args).toEqual(expect.arrayContaining(['-i', 's.m4a', '-c:a', 'aac']));
    expect(args).not.toContain('-shortest');
  });

  it('an animated one without sound plays its loop once', () => {
    expect(stickerVideoArgs({ ...base, sound: null, still: false })).not.toContain('-stream_loop');
  });

  it('a still one ends with its sound; one without sound has no audio track', () => {
    expect(stickerVideoArgs({ ...base, sound: 's.m4a', still: true })).toContain('-shortest');
    expect(stickerVideoArgs({ ...base, sound: null, still: false })).toContain('-an');
  });
});

describe('stickerToVideo (sharp + ffmpeg)', () => {
  const run = promisify(execFile);
  let folder: string;
  let sound: Buffer;
  const probe = async (video: Buffer, name: string) => {
    const path = join(folder, name);
    await writeFile(path, video);
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', path]);
    const parsed = JSON.parse(stdout) as { format: { duration: string }; streams: { codec_type: string }[] };
    return { seconds: Number(parsed.format.duration), kinds: parsed.streams.map((stream) => stream.codec_type).sort() };
  };

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), 'sticker-video-test-'));
    const soundPath = join(folder, 'sound.m4a');
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8', '-c:a', 'aac', soundPath]);
    sound = await readFile(soundPath);
  }, 60_000);
  afterAll(() => rm(folder, { recursive: true, force: true }));

  it('an animated sticker of 2 s with an 8 s sound becomes a 6 s video: the sound is not cut to the loop', async () => {
    // Arrange
    const gifPath = join(folder, 'two.gif');
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=120x120:rate=10:duration=2', gifPath]);
    const picture = await gifToAnimatedSticker(await readFile(gifPath));
    if (typeof picture === 'string') throw new Error(picture);
    // Act
    const video = await stickerToVideo({ picture, sound });
    // Assert
    const info = await probe(video!, 'two.mp4');
    expect(info.kinds).toEqual(['audio', 'video']);
    expect(info.seconds).toBeCloseTo(6, 0);
  }, 60_000);

  it('a short sound under a longer animated sticker keeps the whole loop', async () => {
    // Arrange: a 3 s sticker and a 1 s sound
    const gifPath = join(folder, 'three.gif');
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=120x120:rate=10:duration=3', gifPath]);
    const picture = await gifToAnimatedSticker(await readFile(gifPath));
    if (typeof picture === 'string') throw new Error(picture);
    const shortPath = join(folder, 'short.m4a');
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', 'aac', shortPath]);
    // Act
    const video = await stickerToVideo({ picture, sound: await readFile(shortPath) });
    // Assert
    expect((await probe(video!, 'three.mp4')).seconds).toBeCloseTo(3, 0);
  }, 60_000);

  it('a still sticker with sound lasts at most 6 s; without sound it is only picture', async () => {
    const { default: sharp } = await import('sharp');
    const still = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 0.5 } } }).webp().toBuffer();
    const withSound = await probe((await stickerToVideo({ picture: still, sound }))!, 'still.mp4');
    expect(withSound.seconds).toBeLessThanOrEqual(6.1);
    expect(withSound.kinds).toEqual(['audio', 'video']);
    expect((await probe((await stickerToVideo({ picture: still, sound: null }))!, 'quiet.mp4')).kinds).toEqual(['video']);
  }, 60_000);

  it('bytes that are not a picture give nothing', async () => {
    expect(await stickerToVideo({ picture: Buffer.from('nope'), sound: null })).toBeNull();
  }, 60_000);
});

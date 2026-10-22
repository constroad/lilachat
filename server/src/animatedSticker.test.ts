import { describe, expect, it } from 'vitest';
import { framesWithin, gifToAnimatedSticker, qualitySteps } from './animatedSticker.js';

/** Pending 37 (José, 21/10): «crear yo mismo mis stickers animados» from a GIF. */
describe('framesWithin', () => {
  it('keeps every frame of a GIF up to the limit', () => {
    expect(framesWithin([100, 100, 100], 6_000)).toBe(3);
  });

  it('cuts a long GIF where it passes the limit', () => {
    // Arrange: 80 frames of 100 ms = 8 s
    const delays = Array.from({ length: 80 }, () => 100);
    // Act
    const frames = framesWithin(delays, 6_000);
    // Assert
    expect(frames).toBe(60);
  });

  it('a frame with no delay counts as the browsers draw it (100 ms), not as zero', () => {
    expect(framesWithin(Array.from({ length: 100 }, () => 0), 6_000)).toBe(60);
  });

  it('a single frame is still one frame', () => {
    expect(framesWithin([], 6_000)).toBe(1);
    expect(framesWithin([9_000], 6_000)).toBe(1);
  });
});

describe('qualitySteps', () => {
  it('tries from good to small, never below a readable floor', () => {
    const steps = qualitySteps();
    expect(steps[0]).toBeGreaterThan(steps.at(-1)!);
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(30);
  });
});

describe('gifToAnimatedSticker (sharp)', () => {
  const SIDE = 40;
  const makeGif = async (frames: number, delay = 100) => {
    const { default: sharp } = await import('sharp');
    const raw = Buffer.alloc(SIDE * SIDE * frames * 4);
    for (let frame = 0; frame < frames; frame += 1) raw.fill(frame % 2 ? 255 : 40, frame * SIDE * SIDE * 4, (frame + 1) * SIDE * SIDE * 4);
    return sharp(raw, { raw: { width: SIDE, height: SIDE * frames, channels: 4, pageHeight: SIDE } }).gif({ delay: Array.from({ length: frames }, () => delay), loop: 0 }).toBuffer();
  };

  it('a GIF becomes a 512×512 animated WebP that keeps its frames', async () => {
    const { default: sharp } = await import('sharp');
    const webp = await gifToAnimatedSticker(await makeGif(3));
    expect(Buffer.isBuffer(webp)).toBe(true);
    const metadata = await sharp(webp as Buffer, { animated: true }).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 512, pageHeight: 512, pages: 3 });
    expect((webp as Buffer).length).toBeLessThanOrEqual(500 * 1024);
  });

  it('a GIF longer than 6 s is cut at 6 s', async () => {
    const { default: sharp } = await import('sharp');
    const webp = await gifToAnimatedSticker(await makeGif(80));
    const metadata = await sharp(webp as Buffer, { animated: true }).metadata();
    expect(metadata.pages).toBe(60);
  });

  it('something that is not an image is refused, not thrown', async () => {
    await expect(gifToAnimatedSticker(Buffer.from('no soy un gif'))).resolves.toBe('not-an-image');
  });
});

import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { shrinkPhoto, stampPhoto } from './photoStamp.js';

/** Pending 94: the selfie of a form carries the date, the hour and the place in its pixels. */
describe('stampPhoto', () => {
  it('darkens a band at the bottom with the lines and keeps the size and the top untouched', async () => {
    // Arrange: a white 400×300 photo.
    const white = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    // Act
    const stamped = await stampPhoto(white, ['vie 23/10/2026 · 18:51', '-11.98123, -76.95451 · ± 5 m']);
    // Assert
    const { data, info } = await sharp(stamped).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([400, 300]);
    const pixel = (x: number, y: number) => data[(y * info.width + x) * info.channels]!;
    expect(pixel(2, 2)).toBeGreaterThan(240);
    expect(pixel(2, 297)).toBeLessThan(140);
  });

  it('turns a sideways phone photo upright before stamping, and a broken file throws', async () => {
    // Arrange: a 300×400 photo saved landscape with EXIF «rotate 90».
    const sideways = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    // Act
    const stamped = await stampPhoto(sideways, ['a', 'b']);
    // Assert
    const meta = await sharp(stamped).metadata();
    expect([meta.width, meta.height]).toEqual([300, 400]);
    await expect(stampPhoto(Buffer.from('not an image'), ['a', 'b'])).rejects.toThrow();
  });
});

describe('a form photo is made smaller (agentes, 24/10: Portal uploads it before confirming)', () => {
  it('a 4000 px photo comes back at most 1280 px on its long side, in JPEG; a small one is not enlarged', async () => {
    // Arrange
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#808080' } }).jpeg({ quality: 95 }).toBuffer();
    const small = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#808080' } }).png().toBuffer();
    // Act
    const [shrunkBig, shrunkSmall] = await Promise.all([shrinkPhoto(big), shrinkPhoto(small)]);
    // Assert
    expect(await sharp(shrunkBig).metadata()).toMatchObject({ width: 1280, height: 960, format: 'jpeg' });
    expect(await sharp(shrunkSmall).metadata()).toMatchObject({ width: 640, height: 480, format: 'jpeg' });
  });
});

import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { stampPhoto } from './photoStamp.js';

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

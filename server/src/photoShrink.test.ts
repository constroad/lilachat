import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { shrinkPhotoBuffer } from './photoShrink.js';

const MB = 1024 * 1024;
/** Grain makes a photo heavy the way a real one is; a flat color would weigh nothing. */
const grainy = (width: number, height: number, channels: 3 | 4 = 3) => sharp({ create: { width, height, channels, background: { r: 128, g: 128, b: 128, alpha: 1 }, noise: { type: 'gaussian', mean: 128, sigma: 40 } } });

describe('the server\'s safety net: an old app or a browser without canvas sends the whole photo (Portal\'s standard, 28/10)', () => {
  it('a heavy camera photo comes back at most 1600 px, in JPEG and lighter', async () => {
    // Arrange
    const bytes = await grainy(4000, 3000).jpeg({ quality: 95 }).toBuffer();
    // Act
    const shrunk = await shrinkPhotoBuffer({ bytes, mimeType: 'image/jpeg', fileName: 'IMG_2041.jpg' });
    // Assert
    expect(bytes.length).toBeGreaterThan(MB);
    const meta = await sharp(shrunk!.bytes).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1600);
    expect(shrunk!.bytes.length).toBeLessThan(bytes.length);
    expect(shrunk).toMatchObject({ mimeType: 'image/jpeg', fileName: 'IMG_2041.jpg' });
    expect(shrunk!.log).toMatch(/MB → .* · 4000×3000 → \d+×\d+/);
  });

  it('under 1 MB, a GIF or a broken file: null, the original goes as it came', async () => {
    // Arrange
    const small = await grainy(640, 480).jpeg().toBuffer();
    const gif = await grainy(900, 900).gif().toBuffer();
    const broken = Buffer.alloc(2 * MB, 7);
    // Act
    const results = await Promise.all([
      shrinkPhotoBuffer({ bytes: small, mimeType: 'image/jpeg', fileName: 'a.jpg' }),
      shrinkPhotoBuffer({ bytes: Buffer.concat([gif, Buffer.alloc(MB)]), mimeType: 'image/gif', fileName: 'b.gif' }),
      shrinkPhotoBuffer({ bytes: broken, mimeType: 'image/jpeg', fileName: 'c.jpg' }),
    ]);
    // Assert
    expect(results).toEqual([null, null, null]);
  });

  it('a screenshot (PNG without transparency) becomes JPEG; a logo with real transparency stays PNG with it', async () => {
    // Arrange
    const screenshot = await grainy(1440, 3200).png().toBuffer();
    const logo = await grainy(2000, 2000, 4).composite([{ input: Buffer.from('<svg width="2000" height="2000"><rect x="1000" width="1000" height="2000" fill="#fff"/></svg>'), blend: 'dest-in' }]).png().toBuffer();
    // Act
    const fromScreenshot = await shrinkPhotoBuffer({ bytes: screenshot, mimeType: 'image/png', fileName: 'captura.png' });
    const fromLogo = await shrinkPhotoBuffer({ bytes: logo, mimeType: 'image/png', fileName: 'logo.png' });
    // Assert
    expect(fromScreenshot).toMatchObject({ mimeType: 'image/jpeg', fileName: 'captura.jpg' });
    const logoMeta = await sharp(fromLogo!.bytes).metadata();
    expect(fromLogo).toMatchObject({ mimeType: 'image/png', fileName: 'logo.png' });
    expect([logoMeta.format, logoMeta.hasAlpha, Math.max(logoMeta.width!, logoMeta.height!) <= 1600]).toEqual(['png', true, true]);
  });

  it('a WebP with transparency that turns JPEG gets a white background, never black', async () => {
    // Arrange: the left half fully transparent.
    const half = Buffer.from('<svg width="3000" height="2000"><rect x="1500" width="1500" height="2000" fill="#fff"/></svg>');
    const webp = await grainy(3000, 2000, 4).composite([{ input: half, blend: 'dest-in' }]).webp({ quality: 100, lossless: true }).toBuffer();
    // Act
    const shrunk = await shrinkPhotoBuffer({ bytes: webp, mimeType: 'image/webp', fileName: 'sello.webp' });
    // Assert
    const { data, info } = await sharp(shrunk!.bytes).raw().toBuffer({ resolveWithObject: true });
    expect(shrunk!.mimeType).toBe('image/jpeg');
    expect(data[(10 * info.width + 10) * info.channels]).toBeGreaterThan(245);
  });

  it('a photo saved sideways with its EXIF flag comes back upright', async () => {
    // Arrange: 4000×3000 stored, «rotate 90» in EXIF → 3000×4000 seen.
    const sideways = await grainy(4000, 3000).jpeg({ quality: 95 }).withMetadata({ orientation: 6 }).toBuffer();
    // Act
    const shrunk = await shrinkPhotoBuffer({ bytes: sideways, mimeType: 'image/jpeg', fileName: 'x.jpg' });
    // Assert
    const meta = await sharp(shrunk!.bytes).metadata();
    expect(meta.height!).toBeGreaterThan(meta.width!);
    expect(meta.orientation ?? 1).toBe(1);
  });
});

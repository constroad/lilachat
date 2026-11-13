import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { stampPhoto, stampTimemark } from './photoStamp.js';
import { portalStampsIt } from './botForms.js';

/** Pending 94: the selfie of a form carries the date, the hour and the place in its pixels. */
describe('stampPhoto', () => {
  it('darkens a band at the bottom with the lines and keeps the size and the top untouched', async () => {
    // Arrange: a white 400×300 photo.
    const white = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    // Act
    const stamped = await stampPhoto(white, ['vie 23/10/2026 · 18:51', '-11.98123, -76.95451 · ± 5 m']);
    // Assert
    const { data, info } = await sharp(stamped.bytes).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([400, 300]);
    const pixel = (x: number, y: number) => data[(y * info.width + x) * info.channels]!;
    expect(pixel(2, 2)).toBeGreaterThan(240);
    expect(pixel(2, 297)).toBeLessThan(140);
  });

  it('one line takes a thinner band: a tank photo only says when (José 06/11)', async () => {
    // Arrange
    const white = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    // Act
    const stamped = await stampPhoto(white, ['vie 06/11/2026 · 16:20']);
    // Assert
    const { data, info } = await sharp(stamped.bytes).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => data[(y * info.width + x) * info.channels]!;
    expect(pixel(2, 297)).toBeLessThan(140);
    expect(pixel(2, 260)).toBeGreaterThan(240);
  });

  it('turns a sideways phone photo upright before stamping, and a broken file throws', async () => {
    // Arrange: a 300×400 photo saved landscape with EXIF «rotate 90».
    const sideways = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    // Act
    const stamped = await stampPhoto(sideways, ['a', 'b']);
    // Assert
    const meta = await sharp(stamped.bytes).metadata();
    expect([meta.width, meta.height]).toEqual([300, 400]);
    await expect(stampPhoto(Buffer.from('not an image'), ['a', 'b'])).rejects.toThrow();
  });
});

describe('a stamped selfie follows Portal\'s standard (28/10)', () => {
  it('a 12 MP selfie comes back at most 1600 px, stamped, in JPEG', async () => {
    // Arrange
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 30 } } }).jpeg({ quality: 95 }).toBuffer();
    // Act
    const stamped = await stampPhoto(big, ['mié 28/10/2026 · 10:30', 'Planta Lurín · ± 8 m']);
    // Assert
    expect(await sharp(stamped.bytes).metadata()).toMatchObject({ width: 1600, height: 1200, format: 'jpeg' });
    expect(stamped.bytes.length).toBeLessThan(big.length);
  });
});

/** José 12/11: the report camera burns the Timemark-like stamp it showed live, bottom left, upright or sideways. */
describe('stampTimemark', () => {
  const stamp = { hour: '07:42', date: '12/11/2026', weekday: 'jueves', address: 'Av. Los Incas 1240, Ate, Lima', coords: '-12.0217, -76.8817 · ±6 m' };
  const whiteOf = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
  const pixelsOf = async (bytes: Buffer) => {
    const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
    return { info, at: (x: number, y: number) => data[(y * info.width + x) * info.channels]! };
  };

  it('shades the bottom and writes there, keeps the top and the size, upright and sideways', async () => {
    for (const [width, height] of [[600, 800], [800, 600]] as const) {
      // Act
      const stamped = await stampTimemark(await whiteOf(width, height), stamp, null);
      // Assert
      const { info, at } = await pixelsOf(stamped.bytes);
      expect([info.width, info.height]).toEqual([width, height]);
      expect(at(5, 5)).toBeGreaterThan(240);
      expect(at(width - 5, height - 3)).toBeLessThan(200);
    }
  });

  it('puts the logo at the top right when its chip is on, upright and sideways (José 13/11, like Timemark)', async () => {
    // Arrange: a solid black logo.
    const logo = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#000000' } }).png().toBuffer();
    for (const [width, height] of [[600, 800], [800, 600]] as const) {
      const withLogo = await pixelsOf((await stampTimemark(await whiteOf(width, height), stamp, { dataUri: `data:image/png;base64,${logo.toString('base64')}` })).bytes);
      const without = await pixelsOf((await stampTimemark(await whiteOf(width, height), stamp, null)).bytes);
      // Act: the middle of the logo box (margin 24, size 96 on a 600 px short side).
      const middle = [width - 24 - 48, 24 + 48] as const;
      // Assert: black there only with the logo; the bottom-left corner keeps no logo.
      expect(withLogo.at(...middle)).toBeLessThan(40);
      expect(without.at(...middle)).toBeGreaterThan(240);
      expect(withLogo.at(30, 24 + 48)).toBeGreaterThan(240);
    }
  });
});

describe('portalStampsIt', () => {
  const timemark = { timemark: { logo: true } };

  it('leaves a report photo to Portal unless the run says Lilachat stamps it (José 12/11: never two stamps)', () => {
    // Act
    const portalOwns = portalStampsIt({ informeId: 'r1' }, timemark);
    const lilachatOwns = portalStampsIt({ informeId: 'r1', selloLilachat: true }, timemark);
    // Assert
    expect(portalOwns).toBe(true);
    expect(lilachatOwns).toBe(false);
  });

  it('a form that is not a report, or a photo with no Timemark stamp, is never handed over', () => {
    // Act
    const tank = portalStampsIt({ tanqueId: 't1' }, timemark);
    const hourOnly = portalStampsIt({ informeId: 'r1' }, { hourOnly: true });
    const none = portalStampsIt(undefined, undefined);
    // Assert
    expect([tank, hourOnly, none]).toEqual([false, false, false]);
  });
});

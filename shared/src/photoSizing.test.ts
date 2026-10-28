import { describe, expect, it } from 'vitest';
import { PHOTO_SIZING, createSerialRunner, fitWithin, headerMayHaveAlpha, jpegNameOf, photoOutputType, photoQualities, photoSides, photoSizingLog, shouldShrinkPhoto, shrinkWithLadder } from './photoSizing.js';

const MB = 1024 * 1024;

describe('which photos are shrunk (Portal\'s standard, José 28/10: «sin comprometer la calidad»)', () => {
  it('an image of 1 MB or more, also HEIC and WebP; under 1 MB it goes as it is', () => {
    // Arrange
    const photo = (mimeType: string, sizeBytes: number) => ({ mimeType, sizeBytes });
    // Act
    const big = shouldShrinkPhoto(photo('image/jpeg', 3 * MB));
    const edge = shouldShrinkPhoto(photo('image/png', MB));
    const heic = shouldShrinkPhoto(photo('image/heic', 2 * MB));
    const small = shouldShrinkPhoto(photo('image/jpeg', MB - 1));
    // Assert
    expect([big, edge, heic, small]).toEqual([true, true, true, false]);
  });

  it('never a GIF, an SVG, an icon, a video or a file; never with «HD»', () => {
    // Arrange
    const kinds = ['image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'video/mp4', 'application/pdf'];
    // Act
    const shrunk = kinds.map((mimeType) => shouldShrinkPhoto({ mimeType, sizeBytes: 5 * MB }));
    const hd = shouldShrinkPhoto({ mimeType: 'image/jpeg', sizeBytes: 5 * MB, hd: true });
    const byName = shouldShrinkPhoto({ mimeType: '', sizeBytes: 5 * MB, name: 'saludo.gif' });
    // Assert
    expect(shrunk).toEqual(kinds.map(() => false));
    expect(hd).toBe(false);
    expect(byName).toBe(false);
  });

  it('a file without a type is judged by its name; an unknown size is not shrunk', () => {
    // Arrange
    const named = { mimeType: '', sizeBytes: 2 * MB, name: 'IMG_2041.HEIC' };
    // Act
    const byName = shouldShrinkPhoto(named);
    const unknown = shouldShrinkPhoto({ mimeType: 'image/jpeg', sizeBytes: 0 });
    // Assert
    expect(byName).toBe(true);
    expect(unknown).toBe(false);
  });
});

describe('what comes out', () => {
  it('JPEG, unless the source is a PNG with real transparency', () => {
    // Act
    const screenshot = photoOutputType({ mimeType: 'image/png' }, false);
    const logo = photoOutputType({ mimeType: 'image/png' }, true);
    const webp = photoOutputType({ mimeType: 'image/webp' }, true);
    const byName = photoOutputType({ mimeType: '', name: 'logo.PNG' }, true);
    // Assert
    expect([screenshot, logo, webp, byName]).toEqual(['image/jpeg', 'image/png', 'image/jpeg', 'image/png']);
  });

  it('the name keeps its base and ends in .jpg', () => {
    expect(jpegNameOf('IMG_2041.HEIC')).toBe('IMG_2041.jpg');
    expect(jpegNameOf('captura.png')).toBe('captura.jpg');
    expect(jpegNameOf('sin-extension')).toBe('sin-extension.jpg');
    expect(jpegNameOf('.png')).toBe('foto.jpg');
  });
});

describe('the ladder: 1600 px at 0.78, down to 0.50 in steps of 0.08, then ×0.82 down to 1000 px, 5 passes at most', () => {
  it('the qualities and the sides of a 12 MP photo', () => {
    // Act
    const qualities = photoQualities();
    const sides = photoSides(4000);
    // Assert
    expect(qualities).toEqual([0.78, 0.7, 0.62, 0.54, 0.5]);
    expect(sides).toEqual([1600, 1312, 1076, 1000]);
  });

  it('a photo already under 1600 starts at its own side; one under 1000 gets a single pass', () => {
    // Act
    const mid = photoSides(1200);
    const small = photoSides(800);
    const huge = photoSides(20_000);
    // Assert
    expect(mid).toEqual([1200, 1000]);
    expect(small).toEqual([800]);
    expect(huge).toEqual([1600, 1312, 1076, 1000]);
    expect(huge.length).toBeLessThanOrEqual(PHOTO_SIZING.maxPasses);
  });

  it('fits a side keeping the proportion, never growing', () => {
    // Act
    const landscape = fitWithin(4000, 3000, 1600);
    const portrait = fitWithin(3000, 4000, 1600);
    const small = fitWithin(800, 600, 1600);
    // Assert
    expect(landscape).toEqual({ width: 1600, height: 1200 });
    expect(portrait).toEqual({ width: 1200, height: 1600 });
    expect(small).toEqual({ width: 800, height: 600 });
  });

  it('stops at the first quality under 1 MB, on the first side', async () => {
    // Arrange
    const tried: [number, number][] = [];
    const sizes: Record<string, number> = { '1600:0.78': 1.4 * MB, '1600:0.7': 1.1 * MB, '1600:0.62': 0.9 * MB };
    // Act
    const best = await shrinkWithLadder({ longSide: 4000, originalBytes: 5 * MB, output: 'image/jpeg', encode: async (side, quality) => { tried.push([side, quality]); return { value: `${side}:${quality}`, bytes: sizes[`${side}:${quality}`]! }; } });
    // Assert
    expect(tried).toEqual([[1600, 0.78], [1600, 0.7], [1600, 0.62]]);
    expect(best).toMatchObject({ value: '1600:0.62', side: 1600, quality: 0.62 });
  });

  it('a photo that never fits ends at 1000 px and 0.50, the lightest it reached', async () => {
    // Arrange
    const tried: number[] = [];
    // Act
    const best = await shrinkWithLadder({ longSide: 4000, originalBytes: 9 * MB, output: 'image/jpeg', encode: async (side, quality) => { tried.push(side); return { value: side, bytes: 4 * MB * (side / 1600) * (quality ?? 1) }; } });
    // Assert
    expect([...new Set(tried)]).toEqual([1600, 1312, 1076, 1000]);
    expect(best).toMatchObject({ side: 1000, quality: 0.5 });
  });

  it('a PNG with transparency only changes side: one try per side, no quality', async () => {
    // Arrange
    const tried: [number, number | null][] = [];
    // Act
    const best = await shrinkWithLadder({ longSide: 3000, originalBytes: 4 * MB, output: 'image/png', encode: async (side, quality) => { tried.push([side, quality]); return { value: side, bytes: side > 1100 ? 1.5 * MB : 0.8 * MB }; } });
    // Assert
    expect(tried).toEqual([[1600, null], [1312, null], [1076, null]]);
    expect(best).toMatchObject({ side: 1076 });
  });

  it('a result that is not lighter than the original gives null: the original goes up', async () => {
    // Act
    const heavier = await shrinkWithLadder({ longSide: 1200, originalBytes: 1.1 * MB, output: 'image/jpeg', encode: async () => ({ value: 'x', bytes: 1.2 * MB }) });
    const failed = await shrinkWithLadder({ longSide: 4000, originalBytes: 3 * MB, output: 'image/jpeg', encode: async () => null });
    // Assert
    expect(heavier).toBeNull();
    expect(failed).toBeNull();
  });
});

describe('one photo at a time (agentes, 28/10: a 12 MP decode is ~48 MB; several at once close the app on a low-end phone)', () => {
  it('the second job starts when the first ends, also when the first fails', async () => {
    // Arrange
    const run = createSerialRunner();
    const order: string[] = [];
    let release: () => void = () => undefined;
    const first = run(() => new Promise<void>((resolve) => { order.push('a:start'); release = () => { order.push('a:end'); resolve(); }; }));
    const second = run(async () => { order.push('b:start'); });
    const failing = run(async () => { throw new Error('boom'); });
    const after = run(async () => 'ok');
    // Act
    await Promise.resolve();
    order.push('tick');
    release();
    await first;
    await second;
    const failure = await failing.catch((error: Error) => error.message);
    // Assert
    expect(order).toEqual(['a:start', 'tick', 'a:end', 'b:start']);
    expect(failure).toBe('boom');
    expect(await after).toBe('ok');
  });
});

describe('the log line of an upload', () => {
  it('bytes and pixels before and after', () => {
    expect(photoSizingLog({ bytesBefore: 3.2 * MB, bytesAfter: 412 * 1024, before: { width: 4000, height: 3000 }, after: { width: 1600, height: 1200 } })).toBe('3.2 MB → 412 KB · 4000×3000 → 1600×1200');
    expect(photoSizingLog({ bytesBefore: 600 * 1024, bytesAfter: 600 * 1024 })).toBe('600 KB → 600 KB');
  });
});

describe('transparency from the first bytes (the app cannot read pixels: «may have» keeps it, never a black background)', () => {
  const png = (colorType: number, extra = '') => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1, 0, 0, 0, 1, 0, 8, colorType, 0, 0, 0, ...[...extra].map((char) => char.charCodeAt(0))]);
  const webp = (chunk: string, flags = 0) => Uint8Array.from([...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0)), [...chunk].map((c) => c.charCodeAt(0)), [0, 0, 0, 0, flags]));

  it('a PNG with an alpha channel or a palette with tRNS may; an RGB or gray PNG does not', () => {
    expect(headerMayHaveAlpha(png(6))).toBe(true);
    expect(headerMayHaveAlpha(png(4))).toBe(true);
    expect(headerMayHaveAlpha(png(3, 'PLTE....tRNS'))).toBe(true);
    expect(headerMayHaveAlpha(png(3, 'PLTE....IDAT'))).toBe(false);
    expect(headerMayHaveAlpha(png(2))).toBe(false);
    expect(headerMayHaveAlpha(png(0))).toBe(false);
  });

  it('a WebP with its alpha flag or lossless may; a plain lossy WebP and a JPEG do not', () => {
    expect(headerMayHaveAlpha(webp('VP8X', 0x10))).toBe(true);
    expect(headerMayHaveAlpha(webp('VP8X', 0))).toBe(false);
    expect(headerMayHaveAlpha(webp('VP8L'))).toBe(true);
    expect(headerMayHaveAlpha(webp('VP8 '))).toBe(false);
    expect(headerMayHaveAlpha(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
    expect(headerMayHaveAlpha(new Uint8Array())).toBe(false);
  });
});

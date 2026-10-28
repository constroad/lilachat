import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shrinkPhotoBlob } from './shrinkPhoto';

const MB = 1024 * 1024;
type Call = { canvas: { width: number; height: number }; op: string; args: unknown[] };

/** jsdom has no canvas: a stand-in that records what is drawn and weighs a JPEG by its side and quality. */
function fakeCanvas(options: { transparent: boolean }) {
  const calls: Call[] = [];
  const contexts: Record<string, unknown>[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    const canvas = this;
    const context = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      fillStyle: '',
      fillRect: (...args: unknown[]) => calls.push({ canvas, op: `fill:${context.fillStyle}`, args }),
      drawImage: (...args: unknown[]) => calls.push({ canvas, op: 'draw', args }),
      getImageData: () => ({ data: Uint8ClampedArray.from([0, 0, 0, options.transparent ? 0 : 255]) }),
    };
    contexts.push(context);
    return context as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, done: BlobCallback, type?: string, quality?: number) {
    const bytes = type === 'image/png' ? 0.6 * MB : Math.round(MB * (this.width / 1600) * ((quality ?? 1) / 0.6));
    done(new Blob([new Uint8Array(bytes)], { type }));
  });
  return { calls, contexts };
}

const bitmap = (width: number, height: number) => ({ width, height, close: vi.fn() });

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap(4000, 3000)));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a photo in the browser follows Portal\'s standard (7727ee59; José, 28/10)', () => {
  it('a 3 MB camera photo leaves as JPEG at 1600×1200, painted white first and with high smoothing', async () => {
    // Arrange
    const { calls, contexts } = fakeCanvas({ transparent: false });
    const photo = new File([new Uint8Array(3 * MB)], 'IMG_2041.HEIC', { type: 'image/heic' });
    // Act
    const shrunk = await shrinkPhotoBlob(photo, photo.name);
    // Assert
    expect(shrunk).toMatchObject({ name: 'IMG_2041.jpg', mime: 'image/jpeg', width: 1600, height: 1200 });
    expect(shrunk.blob.size).toBeLessThanOrEqual(MB);
    const final = calls.filter((call) => call.canvas.width === 1600);
    expect(final.map((call) => call.op)).toEqual(['fill:white', 'draw']);
    expect(contexts.every((context) => context.imageSmoothingQuality === 'high')).toBe(true);
  });

  it('a big photo is halved first instead of one jump: 4000 → 2000 → 1600', async () => {
    // Arrange
    const { calls } = fakeCanvas({ transparent: false });
    // Act
    await shrinkPhotoBlob(new File([new Uint8Array(3 * MB)], 'a.jpg', { type: 'image/jpeg' }), 'a.jpg');
    // Assert
    const widths = calls.filter((call) => call.op === 'draw').map((call) => call.canvas.width);
    expect(widths).toEqual([2000, 1600]);
  });

  it('a logo with real transparency stays PNG, never painted', async () => {
    // Arrange
    const { calls } = fakeCanvas({ transparent: true });
    // Act
    const shrunk = await shrinkPhotoBlob(new File([new Uint8Array(4 * MB)], 'logo.png', { type: 'image/png' }), 'logo.png');
    // Assert
    expect(shrunk).toMatchObject({ name: 'logo.png', mime: 'image/png' });
    expect(calls.some((call) => call.op.startsWith('fill'))).toBe(false);
  });

  it('under 1 MB, a GIF or «HD»: the same file, not even decoded', async () => {
    // Arrange
    fakeCanvas({ transparent: false });
    const small = new File([new Uint8Array(MB - 1)], 'a.jpg', { type: 'image/jpeg' });
    const gif = new File([new Uint8Array(3 * MB)], 'b.gif', { type: 'image/gif' });
    const hd = new File([new Uint8Array(3 * MB)], 'c.jpg', { type: 'image/jpeg' });
    // Act
    const results = await Promise.all([shrinkPhotoBlob(small, small.name), shrinkPhotoBlob(gif, gif.name), shrinkPhotoBlob(hd, hd.name, { hd: true })]);
    // Assert
    expect(results.map((result) => result.blob)).toEqual([small, gif, hd]);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('a photo the browser cannot read goes as it came', async () => {
    // Arrange
    fakeCanvas({ transparent: false });
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('unsupported'); }));
    vi.spyOn(globalThis.Image.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) { queueMicrotask(() => this.onerror?.(new Event('error'))); });
    const photo = new File([new Uint8Array(2 * MB)], 'raro.heic', { type: 'image/heic' });
    // Act
    const result = await shrinkPhotoBlob(photo, photo.name);
    // Assert
    expect(result.blob).toBe(photo);
  });
});

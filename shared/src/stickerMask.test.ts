import { describe, expect, it } from 'vitest';
import { brushRadiusInPhoto, canvasToPhoto, maskStroke, photoFrame, type CutoutView } from './stickerMask.js';

// A cutout of 400×800 photo pixels starting at (100, 50), shown 200×400 at (156, 56) of a 512 sticker.
const view: CutoutView = { box: { x: 100, y: 50, width: 400, height: 800 }, geometry: { x: 156, y: 56, width: 200, height: 400 }, side: 512 };

describe('sticker mask brushes (backlog: erase what the cutout left)', () => {
  it('maps a finger point on the sticker to photo pixels', () => {
    // The top-left corner of the shown image is the top-left of the box.
    expect(canvasToPhoto({ x: 156 / 512, y: 56 / 512 }, view)).toEqual({ x: 100, y: 50 });
    // Its bottom-right corner is the end of the box.
    expect(canvasToPhoto({ x: 356 / 512, y: 456 / 512 }, view)).toEqual({ x: 500, y: 850 });
  });

  it('reaches outside the cutout, where «Restaurar» brings the photo back', () => {
    const left = canvasToPhoto({ x: 56 / 512, y: 56 / 512 }, view);
    expect(left.x).toBe(-100);
  });

  it('scales the brush to photo pixels (here 2 photo px per sticker px)', () => {
    expect(brushRadiusInPhoto(0.05, view)).toBeCloseTo(51.2);
  });

  it('builds a stroke in photo pixels and drops points closer than a pixel', () => {
    const stroke = maskStroke('erase', 0.05, [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }], view);
    expect(stroke?.mode).toBe('erase');
    expect(stroke?.radius).toBe(51);
    expect(stroke?.points).toHaveLength(2);
  });

  it('keeps a single tap as a dot, and gives nothing without points or image', () => {
    expect(maskStroke('restore', 0.05, [{ x: 0.5, y: 0.5 }], view)?.points).toHaveLength(1);
    expect(maskStroke('erase', 0.05, [], view)).toBeNull();
    expect(maskStroke('erase', 0.05, [{ x: 0.5, y: 0.5 }], { ...view, geometry: { ...view.geometry, width: 0 } })).toBeNull();
  });

  it('places the whole photo behind the cutout, aligned with it', () => {
    const frame = photoFrame({ width: 1000, height: 1000 }, view);
    // The photo starts 100 photo px (50 sticker px) left of the box.
    expect(frame.x * 512).toBeCloseTo(106);
    expect(frame.y * 512).toBeCloseTo(31);
    expect(frame.width * 512).toBeCloseTo(500);
  });
});

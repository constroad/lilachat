import { describe, expect, it } from 'vitest';
import { ZOOM_CHIPS, zoomFromPinch, zoomLabel } from './zoom';

describe('camera zoom (José 13/11: «.6x 1x 2x»)', () => {
  it('a pinch moves the zoom and never leaves 0..1', () => {
    expect(zoomFromPinch(0, 1)).toBe(0);
    expect(zoomFromPinch(0, 2)).toBe(0.5);
    expect(zoomFromPinch(0.2, 0.2)).toBe(0);
    expect(zoomFromPinch(0.9, 3)).toBe(1);
  });

  it('the label says the ratio; the 2x chip says 2x', () => {
    expect(zoomLabel(0)).toBe('1x');
    expect(zoomLabel(ZOOM_CHIPS[1].zoom)).toBe('2x');
    expect(zoomLabel(0.3125)).toBe('2.5x');
  });
});

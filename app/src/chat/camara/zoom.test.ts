import { describe, expect, it } from 'vitest';
import { MIN_RATIO, MAX_RATIO, ZOOM_CHIPS, nativeZoomOf, zoomFromPinch, zoomLabel } from './zoom';

describe('camera zoom (José 13/11: «.6x 1x 2x»)', () => {
  it('the chips are .6x, 1x and 2x, as WhatsApp', () => {
    expect(ZOOM_CHIPS.map((chip) => chip.label)).toEqual(['.6x', '1x', '2x']);
  });

  it('a pinch multiplies the ratio and never leaves the range', () => {
    expect(zoomFromPinch(1, 1)).toBe(1);
    expect(zoomFromPinch(1, 2)).toBe(2);
    expect(zoomFromPinch(1, 0.1)).toBe(MIN_RATIO);
    expect(zoomFromPinch(4, 5)).toBe(MAX_RATIO);
  });

  it('the label says the ratio: .6x under one, 2.5x with one decimal', () => {
    expect(zoomLabel(0.6)).toBe('.6x');
    expect(zoomLabel(1)).toBe('1x');
    expect(zoomLabel(2.5)).toBe('2.5x');
    expect(zoomLabel(2.04)).toBe('2x');
  });

  // The patched expo-camera (patches/expo-camera+57.0.6.patch) reads a negative zoom as an
  // absolute ratio, down to the lens's own minimum: the phone without a wide lens stays at 1x.
  it('the native zoom is the ratio, negative', () => {
    expect(nativeZoomOf(0.6)).toBe(-0.6);
    expect(nativeZoomOf(2)).toBe(-2);
    expect(nativeZoomOf(99)).toBe(-MAX_RATIO);
  });
});

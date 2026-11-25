import { describe, expect, it } from 'vitest';
import { FALLBACK_RANGE, nativeZoomOf, zoomRangeOf } from './zoom';

describe('the APK camera zoom (José 25/11: «como la cámara de Samsung»)', () => {
  it('reads the lens range the patched ready event carries', () => {
    expect(zoomRangeOf({ minZoom: 0.6, maxZoom: 100 })).toEqual({ min: 0.6, max: 100 });
    expect(zoomRangeOf({ minZoom: 1, maxZoom: 1 })).toEqual({ min: 1, max: 1 });
  });

  it('an event without a range (iOS, an old binary) or a broken one gives null', () => {
    expect(zoomRangeOf(undefined)).toBeNull();
    expect(zoomRangeOf({})).toBeNull();
    expect(zoomRangeOf({ minZoom: 0, maxZoom: 8 })).toBeNull();
    expect(zoomRangeOf({ minZoom: 4, maxZoom: 2 })).toBeNull();
  });

  it('until the camera answers it offers what 0.1.192 did, .6x to 8x', () => {
    expect(FALLBACK_RANGE).toEqual({ min: 0.6, max: 8 });
  });

  // The patched expo-camera reads a negative zoom as an absolute ratio and clamps it to the lens.
  it('the native zoom is the ratio, negative', () => {
    expect(nativeZoomOf(0.6)).toBe(-0.6);
    expect(nativeZoomOf(30)).toBe(-30);
  });
});

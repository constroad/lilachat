import { describe, expect, it } from 'vitest';
import { fittedBox, frameTransform, interpolateRect, openingProgress, type Rect } from './zoomFromBubble';

/**
 * Plan 1, F2: the photo grows out of its bubble, as in Telegram. A frame with
 * `overflow: hidden` travels from the bubble's rectangle to the box the whole
 * photo fills on screen; the image inside covers it, so at the start it looks
 * like the bubble (cropped) and at the end like the full photo (contained).
 * Pure: every function is also a worklet.
 */
const SCREEN = { width: 400, height: 800 };

describe('fittedBox (where the whole photo ends up)', () => {
  it('a landscape photo fills the width and is centered vertically', () => {
    expect(fittedBox(2, SCREEN)).toEqual({ x: 0, y: 300, width: 400, height: 200 });
  });

  it('a tall photo fills the height and is centered horizontally', () => {
    expect(fittedBox(0.25, SCREEN)).toEqual({ x: 100, y: 0, width: 200, height: 800 });
  });

  it('a photo with the screen proportions fills it all', () => {
    expect(fittedBox(0.5, SCREEN)).toEqual({ x: 0, y: 0, width: 400, height: 800 });
  });

  it('a square photo on a tall screen: full width, centered', () => {
    expect(fittedBox(1, SCREEN)).toEqual({ x: 0, y: 200, width: 400, height: 400 });
  });

  it('an unknown or broken proportion fills the screen (never NaN)', () => {
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(fittedBox(aspect, SCREEN)).toEqual({ x: 0, y: 0, width: 400, height: 800 });
    }
  });
});

describe('interpolateRect (the frame between bubble and screen)', () => {
  const bubble: Rect = { x: 40, y: 600, width: 200, height: 150 };
  const target: Rect = { x: 0, y: 300, width: 400, height: 200 };

  it('at 0 it is the bubble, at 1 it is the target', () => {
    expect(interpolateRect(bubble, target, 0)).toEqual(bubble);
    expect(interpolateRect(bubble, target, 1)).toEqual(target);
  });

  it('halfway is halfway on every side', () => {
    expect(interpolateRect(bubble, target, 0.5)).toEqual({ x: 20, y: 450, width: 300, height: 175 });
  });

  it('a spring that overshoots never makes the frame negative', () => {
    const shrinking = interpolateRect({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 0, height: 0 }, 1.2);
    expect(shrinking.width).toBe(0);
    expect(shrinking.height).toBe(0);
  });
});

describe('openingProgress (dragging an open photo down to close it)', () => {
  it('without a drag the photo is fully open', () => {
    expect(openingProgress(0, 800)).toBe(1);
  });

  it('the further it is dragged, the less open it is: gone half a screen away, never below zero', () => {
    expect(openingProgress(200, 800)).toBeCloseTo(0.5);
    expect(openingProgress(-200, 800)).toBeCloseTo(0.5);
    expect(openingProgress(400, 800)).toBe(0);
    expect(openingProgress(2000, 800)).toBe(0);
  });

  it('a screen with no height yet counts as open', () => {
    expect(openingProgress(50, 0)).toBe(1);
  });
});

describe('frameTransform (the flight with transforms only, no layout per frame)', () => {
  const target: Rect = { x: 0, y: 300, width: 400, height: 200 };

  it('at the target nothing moves or scales', () => {
    expect(frameTransform(target, target)).toEqual({ translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, innerScaleX: 1, innerScaleY: 1 });
  });

  it('a bubble with the same shape: the clip and the photo shrink alike', () => {
    const half = frameTransform({ x: 100, y: 350, width: 200, height: 100 }, target);
    expect(half).toEqual({ translateX: 0, translateY: 0, scaleX: 0.5, scaleY: 0.5, innerScaleX: 1, innerScaleY: 1 });
  });

  it('a square bubble crops a wide photo: the photo keeps its shape and covers the clip', () => {
    const square = frameTransform({ x: 40, y: 600, width: 100, height: 100 }, target);
    expect(square.scaleX).toBeCloseTo(0.25);
    expect(square.scaleY).toBeCloseTo(0.5);
    // Seen through the clip, the photo is scaled 0.5 both ways: 200 x 100, covering the 100 x 100 bubble.
    expect(square.scaleX * square.innerScaleX).toBeCloseTo(0.5);
    expect(square.scaleY * square.innerScaleY).toBeCloseTo(0.5);
  });

  it('moves the centre of the clip onto the centre of the bubble', () => {
    const moved = frameTransform({ x: 40, y: 600, width: 100, height: 100 }, target);
    expect(moved.translateX).toBeCloseTo(90 - 200);
    expect(moved.translateY).toBeCloseTo(650 - 400);
  });

  it('a target with no size yet never divides by zero', () => {
    const none = frameTransform({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 0, height: 0 });
    expect(Object.values(none).every(Number.isFinite)).toBe(true);
  });
});

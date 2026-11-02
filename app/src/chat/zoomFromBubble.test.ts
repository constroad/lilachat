import { describe, expect, it } from 'vitest';
import { fittedBox, interpolateRect, openingProgress, type Rect } from './zoomFromBubble';

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

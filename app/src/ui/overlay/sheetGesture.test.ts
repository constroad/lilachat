import { describe, expect, it } from 'vitest';
import { backdropOpacity, clampDrag, DISMISS_FRACTION, DISMISS_VELOCITY, shouldDismiss } from './sheetGesture';

/**
 * Plan 1, F1 (PLANES-FLUIDEZ-IOS-PWA §1.3): the sheets leave React Native's
 * `Modal` (a second window on Android) and live in the app's own window, where
 * a finger can drag them down to close. The decision «let it go or bring it
 * back» is pure: it runs on the UI thread as a worklet and in vitest as is.
 */
const HEIGHT = 300;

describe('shouldDismiss', () => {
  it('dragged a little and released slowly: it comes back', () => {
    expect(shouldDismiss({ translateY: 40, velocityY: 50, height: HEIGHT })).toBe(false);
  });

  it('dragged past a third of its height: it goes', () => {
    expect(shouldDismiss({ translateY: HEIGHT * DISMISS_FRACTION + 1, velocityY: 0, height: HEIGHT })).toBe(true);
  });

  it('a quick downward flick closes it even from a short drag', () => {
    expect(shouldDismiss({ translateY: 20, velocityY: DISMISS_VELOCITY + 1, height: HEIGHT })).toBe(true);
  });

  it('an upward flick never closes it, however far it was dragged', () => {
    expect(shouldDismiss({ translateY: HEIGHT * 0.9, velocityY: -DISMISS_VELOCITY * 2, height: HEIGHT })).toBe(false);
  });

  it('a sheet that has not been measured yet (height 0) stays', () => {
    expect(shouldDismiss({ translateY: 10, velocityY: 0, height: 0 })).toBe(false);
  });
});

describe('clampDrag', () => {
  it('the sheet never rises above its resting place', () => {
    expect(clampDrag(-80)).toBe(0);
  });

  it('downward it follows the finger', () => {
    expect(clampDrag(120)).toBe(120);
  });
});

describe('backdropOpacity', () => {
  it('at rest the backdrop is at its full shade', () => {
    expect(backdropOpacity(0, HEIGHT, 0.4)).toBe(0.4);
  });

  it('fades out as the sheet goes down, and never below zero', () => {
    expect(backdropOpacity(HEIGHT / 2, HEIGHT, 0.4)).toBeCloseTo(0.2);
    expect(backdropOpacity(HEIGHT, HEIGHT, 0.4)).toBe(0);
    expect(backdropOpacity(HEIGHT * 2, HEIGHT, 0.4)).toBe(0);
  });

  it('with no height yet, the full shade (no division by zero)', () => {
    expect(backdropOpacity(10, 0, 0.4)).toBe(0.4);
  });
});

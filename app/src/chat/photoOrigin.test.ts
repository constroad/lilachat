import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPhotoOrigin, openFromBubble, photoOriginOf, rememberPhotoOrigin } from './photoOrigin';

/**
 * Plan 1, F2: where the tapped photo was on screen. The bubble measures itself
 * on the tap and the viewer reads it to grow the photo out of that place, and
 * to send it back there when it closes.
 */
describe('photoOrigin', () => {
  beforeEach(() => forgetPhotoOrigin());

  it('the viewer finds the place of the photo that was tapped', () => {
    rememberPhotoOrigin(12, { x: 40, y: 600, width: 220, height: 160 });
    expect(photoOriginOf(12)).toEqual({ x: 40, y: 600, width: 220, height: 160 });
  });

  it('another photo (swiped to in the viewer) has no place: it fades instead', () => {
    rememberPhotoOrigin(12, { x: 40, y: 600, width: 220, height: 160 });
    expect(photoOriginOf(13)).toBeUndefined();
  });

  it('only the last tap counts', () => {
    rememberPhotoOrigin(12, { x: 40, y: 600, width: 220, height: 160 });
    rememberPhotoOrigin(14, { x: 10, y: 100, width: 200, height: 200 });
    expect(photoOriginOf(12)).toBeUndefined();
    expect(photoOriginOf(14)).toEqual({ x: 10, y: 100, width: 200, height: 200 });
  });

  it('a bubble not laid out yet (no size) leaves no place', () => {
    rememberPhotoOrigin(12, { x: 0, y: 0, width: 0, height: 0 });
    expect(photoOriginOf(12)).toBeUndefined();
    rememberPhotoOrigin(15, { x: Number.NaN, y: 3, width: 10, height: 10 });
    expect(photoOriginOf(15)).toBeUndefined();
  });

  it('forgetting it leaves nothing behind', () => {
    rememberPhotoOrigin(12, { x: 40, y: 600, width: 220, height: 160 });
    forgetPhotoOrigin();
    expect(photoOriginOf(12)).toBeUndefined();
  });
});

describe('openFromBubble (the tap on a photo)', () => {
  beforeEach(() => forgetPhotoOrigin());
  afterEach(() => vi.useRealTimers());
  const tapOn = (rect: [number, number, number, number]) => ({
    currentTarget: { measureInWindow: (done: (...r: [number, number, number, number]) => void) => done(...rect) },
  });

  it('measures the bubble BEFORE opening, so the viewer already knows where it was', () => {
    const opened: (number | undefined)[] = [];
    openFromBubble(tapOn([40, 600, 220, 160]), 12, (seq) => opened.push(photoOriginOf(seq)?.y));
    expect(opened).toEqual([600]);
  });

  it('a tap without a measurable target still opens (it fades in)', () => {
    const opened: number[] = [];
    openFromBubble({ currentTarget: 7 }, 12, (seq) => opened.push(seq));
    expect(opened).toEqual([12]);
    expect(photoOriginOf(12)).toBeUndefined();
  });

  it('a measurement that answers later still arrives before the opening (the viewer needs the place)', () => {
    vi.useFakeTimers();
    let answer: (() => void) | undefined;
    const late = { currentTarget: { measureInWindow: (done: (...r: [number, number, number, number]) => void) => (answer = () => done(40, 600, 220, 160)) } };
    const opened: (number | undefined)[] = [];
    openFromBubble(late, 12, (seq) => opened.push(photoOriginOf(seq)?.y));
    expect(opened).toEqual([]);
    answer?.();
    expect(opened).toEqual([600]);
    vi.advanceTimersByTime(500);
    expect(opened).toEqual([600]);
  });

  it('a measurement that never answers still opens, a moment later (it fades in)', () => {
    vi.useFakeTimers();
    const silent = { currentTarget: { measureInWindow: () => undefined } };
    const opened: number[] = [];
    openFromBubble(silent, 12, (seq) => opened.push(seq));
    vi.advanceTimersByTime(150);
    expect(opened).toEqual([12]);
  });

  it('with nothing to open, nothing is measured', () => {
    openFromBubble(tapOn([40, 600, 220, 160]), 12, undefined);
    expect(photoOriginOf(12)).toBeUndefined();
  });
});

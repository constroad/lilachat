import { describe, expect, it } from 'vitest';
import { formatClipClock, formatClipLength, initialTrim, msOfDistance, resizeTrim, shouldLoopBack, slideTrim, stripFrameTimes, trimFrame, trimSummary } from './videoStickerTrim';

/** José 26/11 (design ss-01): a window of 0.5 to 6 s of the video, slid or stretched on the strip. */
describe('initialTrim', () => {
  it('starts at the beginning and keeps 6 seconds of a long video', () => {
    expect(initialTrim(30_000)).toEqual({ startMs: 0, endMs: 6_000 });
  });

  it('keeps the whole video when it is shorter than 6 seconds', () => {
    expect(initialTrim(3_400)).toEqual({ startMs: 0, endMs: 3_400 });
  });

  it('refuses a video shorter than half a second, or with no length', () => {
    expect(initialTrim(400)).toBeNull();
    expect(initialTrim(Number.NaN)).toBeNull();
  });
});

describe('slideTrim', () => {
  it('moves the window keeping its length', () => {
    expect(slideTrim({ startMs: 0, endMs: 6_000 }, 12_000, 30_000)).toEqual({ startMs: 12_000, endMs: 18_000 });
  });

  it('stops at both ends of the video', () => {
    expect(slideTrim({ startMs: 2_000, endMs: 8_000 }, -5_000, 30_000)).toEqual({ startMs: 0, endMs: 6_000 });
    expect(slideTrim({ startMs: 20_000, endMs: 26_000 }, 9_000, 30_000)).toEqual({ startMs: 24_000, endMs: 30_000 });
  });
});

describe('resizeTrim', () => {
  it('shortens from the end, never under half a second', () => {
    expect(resizeTrim({ startMs: 1_000, endMs: 7_000 }, 'end', -2_000, 30_000)).toEqual({ startMs: 1_000, endMs: 5_000 });
    expect(resizeTrim({ startMs: 1_000, endMs: 7_000 }, 'end', -9_000, 30_000)).toEqual({ startMs: 1_000, endMs: 1_500 });
  });

  it('never stretches past 6 seconds nor past the video', () => {
    expect(resizeTrim({ startMs: 1_000, endMs: 4_000 }, 'end', 9_000, 30_000)).toEqual({ startMs: 1_000, endMs: 7_000 });
    expect(resizeTrim({ startMs: 1_000, endMs: 4_000 }, 'end', 9_000, 5_000)).toEqual({ startMs: 1_000, endMs: 5_000 });
  });

  it('moves the start edge between the 6-second limit and half a second before the end', () => {
    expect(resizeTrim({ startMs: 10_000, endMs: 14_000 }, 'start', -5_000, 30_000)).toEqual({ startMs: 8_000, endMs: 14_000 });
    expect(resizeTrim({ startMs: 10_000, endMs: 14_000 }, 'start', 9_000, 30_000)).toEqual({ startMs: 13_500, endMs: 14_000 });
    expect(resizeTrim({ startMs: 1_000, endMs: 4_000 }, 'start', -3_000, 30_000)).toEqual({ startMs: 0, endMs: 4_000 });
  });
});

describe('the strip', () => {
  it('turns the finger into milliseconds, and nothing before it is measured', () => {
    expect(msOfDistance(50, 300, 30_000)).toBe(5_000);
    expect(msOfDistance(50, 0, 30_000)).toBe(0);
  });

  it('places the window on the strip', () => {
    expect(trimFrame({ startMs: 12_000, endMs: 18_000 }, 300, 30_000)).toEqual({ left: 120, width: 60 });
    expect(trimFrame({ startMs: 0, endMs: 6_000 }, 0, 30_000)).toEqual({ left: 0, width: 0 });
  });

  it('takes its frames from the middle of each part', () => {
    expect(stripFrameTimes(8_000, 4)).toEqual([1, 3, 5, 7]);
    expect(stripFrameTimes(0, 4)).toEqual([]);
  });
});

describe('labels', () => {
  it('says the length and the range like the design', () => {
    expect(trimSummary({ startMs: 12_000, endMs: 18_000 })).toEqual({ length: '6 s seleccionados', range: '0:12 – 0:18' });
  });

  it('writes tenths with a comma and minutes past a minute', () => {
    expect(formatClipLength(2_540)).toBe('2,5 s');
    expect(formatClipClock(75_400)).toBe('1:15');
    expect(formatClipClock(-20)).toBe('0:00');
  });
});

describe('shouldLoopBack', () => {
  it('jumps back at the end of the window or when the player is before it', () => {
    const trim = { startMs: 2_000, endMs: 5_000 };
    expect(shouldLoopBack(5_000, trim)).toBe(true);
    expect(shouldLoopBack(1_000, trim)).toBe(true);
    expect(shouldLoopBack(3_000, trim)).toBe(false);
    expect(shouldLoopBack(1_950, trim)).toBe(false);
  });
});

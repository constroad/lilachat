import { describe, expect, it } from 'vitest';
import { firstPlay, nextPlaybackRate, scrubFraction } from './voiceNote.js';

/** Voice notes like WhatsApp (FL9b; backlog 34, José 21/10: «se siente torpe, recién al segundo toque, y no se puede adelantar ni retroceder»). */
describe('voice notes', () => {
  it('speed: 1× → 1,5× → 2× → 1×, and an odd value goes back to 1×', () => {
    expect(nextPlaybackRate(1)).toBe(1.5);
    expect(nextPlaybackRate(1.5)).toBe(2);
    expect(nextPlaybackRate(2)).toBe(1);
    expect(nextPlaybackRate(3)).toBe(1);
  });
  it('dragging along the bar gives a share of the audio, kept inside it', () => {
    expect(scrubFraction(50, 200)).toBe(0.25);
    expect(scrubFraction(-30, 200)).toBe(0);
    expect(scrubFraction(260, 200)).toBe(1);
    expect(scrubFraction(10, 0)).toBe(0);
    expect(scrubFraction(Number.NaN, 200)).toBe(0);
  });
  it('the first tap plays as soon as the audio is loaded, from where it was asked, only once', () => {
    expect(firstPlay({ loaded: false, started: false, startShare: null, duration: 12 })).toEqual({ play: false });
    expect(firstPlay({ loaded: true, started: false, startShare: null, duration: 12 })).toEqual({ play: true, seekTo: 0 });
    expect(firstPlay({ loaded: true, started: false, startShare: 0.5, duration: 12 })).toEqual({ play: true, seekTo: 6 });
    expect(firstPlay({ loaded: true, started: true, startShare: 0.5, duration: 12 })).toEqual({ play: false });
  });
});

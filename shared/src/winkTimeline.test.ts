import { describe, expect, it } from 'vitest';
import { actorBox, actorTracks, danceTrack, easeShare, isStillTrack, mergeTracks, partTracks, sampleTrack, stageUnit, type Ease } from './winkTimeline.js';
import { DANCES } from './winkDances.js';

/** José, 21/10: a wink is a funny sketch with a punchline, not everybody dancing. */
describe('actorTracks', () => {
  it('each property moves on its own: a key that only turns the actor does not stop it from walking', () => {
    const tracks = actorTracks([{ at: 0, x: 1.5 }, { at: 0.1, sx: 0.5 }, { at: 0.2, x: 0.5 }]);
    expect(tracks.x.ats).toEqual([0, 0.2, 1]);
    expect(sampleTrack(tracks.x, 0.1)).toBeCloseTo(1);
    expect(tracks.sx.ats).toEqual([0, 0.1, 1]);
  });

  it('a property nobody sets keeps its default (middle of the screen, full size, upright, visible)', () => {
    const tracks = actorTracks([]);
    expect(tracks.x.values).toEqual([0.5, 0.5]);
    expect(tracks.scale.values).toEqual([1, 1]);
    expect(tracks.sx.values).toEqual([1, 1]);
    expect(tracks.rotate.values).toEqual([0, 0]);
    expect(tracks.opacity.values).toEqual([1, 1]);
  });

  it('holds the first value before its first key and the last one after its last key', () => {
    const tracks = actorTracks([{ at: 0.3, opacity: 0 }, { at: 0.4, opacity: 1 }]);
    expect(tracks.opacity.ats).toEqual([0, 0.3, 0.4, 1]);
    expect(tracks.opacity.values).toEqual([0, 0, 1, 1]);
  });

  it('two keys at the same moment become an instant jump that still moves forward in time (renderers need it)', () => {
    const { ats } = actorTracks([{ at: 0.5, opacity: 1 }, { at: 0.5, opacity: 0 }]).opacity;
    for (let index = 1; index < ats.length; index += 1) expect(ats[index]!).toBeGreaterThan(ats[index - 1]!);
  });

  it('the ease of a key shapes how the segment arrives at it («out» brakes, «in» speeds up)', () => {
    const linear = actorTracks([{ at: 0.2, x: 0 }, { at: 0.6, x: 1, ease: 'linear' }]);
    expect(linear.x.eases).toEqual(['smooth', 'smooth', 'linear', 'smooth']);
    expect(sampleTrack(linear.x, 0.4)).toBeCloseTo(0.5);
    expect(sampleTrack(actorTracks([{ at: 0, x: 0 }, { at: 1, x: 1, ease: 'out' }]).x, 0.5)).toBeGreaterThan(0.5);
    expect(sampleTrack(actorTracks([{ at: 0, x: 0 }, { at: 1, x: 1, ease: 'in' }]).x, 0.5)).toBeLessThan(0.5);
  });
});

describe('partTracks', () => {
  it('a part rests at 0, full size and visible unless the script moves it; a still part is detected', () => {
    const tracks = partTracks([{ at: 0.5, scaleY: 0.1 }]);
    expect(tracks.scaleY.values).toEqual([0.1, 0.1, 0.1]);
    expect(isStillTrack(tracks.rotate)).toBe(true);
    expect(partTracks(undefined).opacity.values).toEqual([1, 1]);
    expect(isStillTrack(partTracks([{ at: 0.2, rotate: 0 }, { at: 0.4, rotate: 20 }]).rotate)).toBe(false);
  });
});

describe('easing and sampling', () => {
  it('every ease starts at 0 and ends at 1; «in» starts slow and «out» starts fast', () => {
    for (const ease of ['smooth', 'linear', 'in', 'out'] as const) {
      expect(easeShare(ease, 0)).toBe(0);
      expect(easeShare(ease, 1)).toBe(1);
    }
    expect(easeShare('in', 0.5)).toBeLessThan(0.5);
    expect(easeShare('out', 0.5)).toBeGreaterThan(0.5);
    expect(easeShare('smooth', 0.5)).toBeCloseTo(0.5);
  });

  it('samples a track between its keys and holds outside them', () => {
    const track = { ats: [0, 0.5, 1], values: [0, 10, 0], eases: ['linear', 'linear', 'linear'] as Ease[] };
    expect(sampleTrack(track, 0.25)).toBeCloseTo(5);
    expect(sampleTrack(track, 0.5)).toBe(10);
    expect(sampleTrack(track, -1)).toBe(0);
    expect(sampleTrack(track, 2)).toBe(0);
  });
});

describe('the stage', () => {
  it('a phone held upright uses its width; a wide window is capped by its height and by 560 px', () => {
    expect(stageUnit(390, 844)).toBe(390);
    expect(stageUnit(1280, 800)).toBe(560);
    expect(stageUnit(2560, 1440)).toBe(560);
    expect(stageUnit(1280, 500)).toBe(375);
  });

  it('an actor box keeps its drawing proportions; «width» spans the screen', () => {
    expect(actorBox('0 0 240 320', 'unit', { width: 390, height: 844 })).toEqual({ width: 390, height: 520 });
    expect(actorBox('0 0 200 200', 'width', { width: 1280, height: 800 })).toEqual({ width: 1280, height: 1280 });
  });
});

describe('danceTrack', () => {
  it('repeats a dance only inside its window and rests outside it', () => {
    const keys = danceTrack(DANCES.cumbia, 'arm-left', 0.2, 0.6, 4000);
    expect(keys[0]).toEqual({ at: 0.2, rotate: 0 });
    expect(keys.at(-1)).toEqual({ at: 0.6, rotate: 0 });
    expect(keys.every((key) => key.at >= 0.2 && key.at <= 0.6)).toBe(true);
    expect(keys.some((key) => key.rotate !== 0)).toBe(true);
  });
  it('a part the dance does not move gives nothing', () => {
    expect(danceTrack(DANCES.cumbia, 'eye-left', 0, 1, 4000)).toEqual([]);
  });
});

describe('mergeTracks', () => {
  it('joins two moments of the same part in time order', () => {
    expect(mergeTracks([{ at: 0.5, rotate: 10 }], [{ at: 0.1, rotate: 5 }]).map((key) => key.at)).toEqual([0.1, 0.5]);
  });
});

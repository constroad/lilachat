import { describe, expect, it } from 'vitest';
import { WINK_SKETCHES } from '@lilachat/shared';
import { actorFrames, frameMoments, partFrames } from './sketchFrames';

describe('the sketch keyframes', () => {
  it('one frame every 20 ms, from the first moment to the last', () => {
    const moments = frameMoments(100);
    expect(moments).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('places the actor by its center and scales it around its middle', () => {
    const frames = actorFrames({ art: { prop: 'heart' }, keys: [{ at: 0, x: 0.5, y: 0.5, scale: 2, rotate: 10 }] }, { width: 100, height: 100 }, { width: 400, height: 800 }, 40);
    expect(frames[0]).toMatchObject({ offset: 0, opacity: 1, transform: 'translate(150.0px, 350.0px) rotate(10.00deg) scale(2.0000, 2.0000)' });
  });

  it('a mirrored actor gets a negative horizontal scale', () => {
    const frames = actorFrames({ art: { prop: 'heart' }, keys: [{ at: 0, sx: -1 }] }, { width: 10, height: 10 }, { width: 10, height: 10 }, 20);
    expect(frames[0]!.transform).toContain('scale(-1.0000, 1.0000)');
  });

  it('a part the sketch never moves is left as drawn; one it moves gets its frames', () => {
    expect(partFrames(undefined, 1000)).toBeNull();
    const tail = WINK_SKETCHES.piggy.actors[1]!.parts?.tail;
    const frames = partFrames(tail, WINK_SKETCHES.piggy.durationMs);
    expect(frames?.length).toBeGreaterThan(300);
    expect(frames?.some((frame) => String(frame.transform).includes('rotate(-'))).toBe(true);
  });
});

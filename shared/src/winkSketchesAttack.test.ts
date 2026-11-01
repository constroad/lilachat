import { describe, expect, it } from 'vitest';
import { ATTACK_SKETCHES } from './winkSketchesAttack.js';
import { actorTracks, sampleTrack, type Sketch, type SketchActor } from './winkTimeline.js';

/** José 02/11: «Te ataco», each wink hits the screen of whoever gets it and ends with a punchline. */
const propOf = (actor: SketchActor) => ('prop' in actor.art ? actor.art.prop : undefined);
const actorsOf = (sketch: Sketch, prop: string) => sketch.actors.filter((actor) => propOf(actor) === prop);
const opacityAt = (actor: SketchActor, at: number) => sampleTrack(actorTracks(actor.keys).opacity, at);
const shownAt = (actor: SketchActor, at: number) => opacityAt(actor, at) > 0.5;

describe('the «Te ataco» sketches', () => {
  it('each one hits the glass: an impact with a screen effect before the middle of the wink', () => {
    for (const [id, sketch] of Object.entries(ATTACK_SKETCHES)) {
      const impact = sketch.cues.find((cue) => cue.screen && cue.at < 0.55);
      expect(impact, id).toBeDefined();
    }
  });

  it('each one has a punchline after 60 % of the wink: something new shows up, falls, or shakes the screen', () => {
    const lateMoments = Array.from({ length: 20 }, (_, step) => 0.6 + step * 0.015);
    for (const [id, sketch] of Object.entries(ATTACK_SKETCHES)) {
      const appears = sketch.actors.some((actor) => !shownAt(actor, 0.55) && lateMoments.some((at) => shownAt(actor, at)));
      const falls = sketch.actors.some((actor) => sampleTrack(actorTracks(actor.keys).y, 0.9) - sampleTrack(actorTracks(actor.keys).y, 0.6) > 0.3);
      const shakes = sketch.cues.some((cue) => cue.screen && cue.at >= 0.6);
      expect(appears || falls || shakes, id).toBe(true);
    }
  });

  it('the slipper: the first one leaves its red mark and THE SECOND one comes after it', () => {
    // Arrange
    const sketch = ATTACK_SKETCHES['hit-slipper'];
    const [first, second] = actorsOf(sketch, 'slipper');
    // Assert
    expect(actorsOf(sketch, 'slipper')).toHaveLength(2);
    expect(shownAt(actorsOf(sketch, 'slipper-mark')[0]!, 0.55)).toBe(true);
    expect(shownAt(first!, 0.7)).toBe(false);
    expect(shownAt(second!, 0.82)).toBe(true);
  });

  it('the egg slides raw and then fries on the screen', () => {
    const sketch = ATTACK_SKETCHES['hit-egg'];
    expect(shownAt(actorsOf(sketch, 'raw-egg')[0]!, 0.45)).toBe(true);
    expect(shownAt(actorsOf(sketch, 'fried-egg')[0]!, 0.45)).toBe(false);
    expect(shownAt(actorsOf(sketch, 'fried-egg')[0]!, 0.8)).toBe(true);
    expect(shownAt(actorsOf(sketch, 'raw-egg')[0]!, 0.8)).toBe(false);
    expect(sketch.cues.some((cue) => cue.sound === 'sizzle' && cue.at > 0.6)).toBe(true);
  });

  it('the swatter misses: the fly is gone under it and comes back laughing', () => {
    const sketch = ATTACK_SKETCHES['hit-swatter'];
    const flies = actorsOf(sketch, 'fly');
    expect(flies.some((fly) => shownAt(fly, 0.4))).toBe(true);
    expect(flies.some((fly) => shownAt(fly, 0.58))).toBe(false);
    expect(flies.some((fly) => shownAt(fly, 0.72))).toBe(true);
    expect(sketch.cues.filter((cue) => cue.sound === 'buzz').length).toBeGreaterThanOrEqual(2);
  });

  it('the ball cracks the glass and says sorry; the tomato leaves only its stem falling', () => {
    expect(shownAt(actorsOf(ATTACK_SKETCHES['hit-ball'], 'glass-star-crack')[0]!, 0.5)).toBe(true);
    expect(shownAt(actorsOf(ATTACK_SKETCHES['hit-ball'], 'sorry-sign')[0]!, 0.8)).toBe(true);
    const stem = actorsOf(ATTACK_SKETCHES['hit-tomato'], 'tomato-stem')[0]!;
    expect(sampleTrack(actorTracks(stem.keys).y, 0.89)).toBeGreaterThan(sampleTrack(actorTracks(stem.keys).y, 0.6) + 0.4);
  });
});

import { describe, expect, it } from 'vitest';
import { WINK_ART, WINK_PROPS } from './winkArt.js';
import { WINK_SKETCHES } from './winkSketches.js';
import { actorTracks, partTracks, sampleTrack, type SketchActor } from './winkTimeline.js';
import { WINKS, WINK_SOUNDS } from './winks.js';

const sketches = Object.entries(WINK_SKETCHES);
const artOf = (actor: SketchActor) => ('character' in actor.art ? WINK_ART[actor.art.character] : WINK_PROPS[actor.art.prop]);
const allKeys = (actor: SketchActor) => [...actor.keys, ...Object.values(actor.parts ?? {}).flat()];
/** Not to be seen: invisible, or its center well off the screen. */
function unseenAt(actor: SketchActor, at: number): boolean {
  const tracks = actorTracks(actor.keys);
  const x = sampleTrack(tracks.x, at);
  const y = sampleTrack(tracks.y, at);
  return sampleTrack(tracks.opacity, at) < 0.01 || x <= -0.4 || x >= 1.4 || y >= 1.15 || Math.abs(sampleTrack(tracks.sx, at)) < 0.05;
}

/** José, 21/10: «estos se trata de que sean graciosos, no de que todos bailen». */
describe('the wink sketches', () => {
  it('every character wink has its sketch, lasting 6 to 7.5 s like MSN’s (José: «duraba un poco más»)', () => {
    for (const wink of WINKS.filter((item) => item.kind === 'character')) {
      const sketch = WINK_SKETCHES[wink.id as keyof typeof WINK_SKETCHES];
      expect(sketch, wink.id).toBeDefined();
      expect(sketch.durationMs).toBeGreaterThanOrEqual(6000);
      expect(sketch.durationMs).toBeLessThanOrEqual(7500);
    }
  });

  it('every actor is drawn, and every part a sketch moves exists in its drawing', () => {
    for (const [id, sketch] of sketches) {
      for (const actor of sketch.actors) {
        const art = artOf(actor);
        expect(art, id).toBeDefined();
        const names = art.parts.map((part) => part.part);
        for (const part of Object.keys(actor.parts ?? {})) expect(names, `${id} ${part}`).toContain(part);
      }
    }
  });

  it('every moment is inside the wink and every sound is one the clients carry', () => {
    for (const [id, sketch] of sketches) {
      for (const actor of sketch.actors) for (const key of allKeys(actor)) expect(key.at >= 0 && key.at <= 1, `${id} ${key.at}`).toBe(true);
      for (const cue of sketch.cues) {
        expect(cue.at >= 0 && cue.at <= 1, id).toBe(true);
        if (cue.sound) expect(WINK_SOUNDS, id).toContain(cue.sound);
      }
    }
  });

  it('nothing pops in or out: every actor starts and ends unseen (faded, tiny or off the screen)', () => {
    for (const [id, sketch] of sketches) {
      sketch.actors.forEach((actor, index) => {
        expect(unseenAt(actor, 0) || sampleTrack(actorTracks(actor.keys).scale, 0) <= 0.2, `${id} actor ${index} at the start`).toBe(true);
        expect(unseenAt(actor, 1), `${id} actor ${index} at the end`).toBe(true);
      });
    }
  });

  it('only the cone dances: every other sketch has a beat that is not a dance (a prop, a screen effect, a face, a turn)', () => {
    for (const [id, sketch] of sketches) {
      if (id === 'cone') continue;
      const hasProp = sketch.actors.some((actor) => 'prop' in actor.art);
      const hasScreen = sketch.cues.some((cue) => cue.screen);
      const hasFace = sketch.actors.some((actor) => ['eye-left', 'eye-right', 'mouth', 'held'].some((part) => actor.parts?.[part as 'mouth']));
      const hasTurn = sketch.actors.some((actor) => actor.keys.some((key) => key.sx !== undefined && key.sx < 0.1));
      expect(hasProp || hasScreen || hasFace || hasTurn, id).toBe(true);
    }
  });

  it('the panda really hugs: both arms close in front of it', () => {
    const arms = partTracks(WINK_SKETCHES.panda.actors[0]!.parts?.['arm-left']);
    const other = partTracks(WINK_SKETCHES.panda.actors[0]!.parts?.['arm-right']);
    expect(Math.min(...arms.rotate.values)).toBeLessThanOrEqual(-60);
    expect(Math.max(...other.rotate.values)).toBeGreaterThanOrEqual(60);
  });

  it('the pig turns around and wiggles its tail (José: «gordito moviendo y enseñando el rabo»)', () => {
    const back = WINK_SKETCHES.piggy.actors.find((actor) => 'character' in actor.art && actor.art.character === 'piggy-back');
    expect(back).toBeDefined();
    const tail = partTracks(back!.parts?.tail);
    expect(tail.rotate.values.filter((value) => Math.abs(value) >= 30).length).toBeGreaterThanOrEqual(6);
    expect(Math.max(...tail.scale.values)).toBeGreaterThan(1.5);
    expect(sampleTrack(actorTracks(back!.keys).opacity, 0.45)).toBe(1);
  });

  it('the galán winks for real: one eye shuts twice while the other stays open, and the rose leaves his hand', () => {
    const galan = WINK_SKETCHES.sweetheart.actors[0]!;
    const right = partTracks(galan.parts?.['eye-right']).scaleY;
    expect(right.values.filter((value) => value < 0.1).length).toBeGreaterThanOrEqual(4);
    expect(sampleTrack(partTracks(galan.parts?.['eye-left']).scaleY, 0.26)).toBe(1);
    expect(sampleTrack(partTracks(galan.parts?.held).opacity, 0.7)).toBe(0);
  });

  it('the water balloon bursts: the splash shows up as the balloon vanishes', () => {
    const [flying, splash] = WINK_SKETCHES.balloon.actors;
    expect(sampleTrack(actorTracks(flying!.keys).opacity, 0.32)).toBe(0);
    expect(sampleTrack(actorTracks(splash!.keys).opacity, 0.32)).toBe(1);
    expect(sampleTrack(actorTracks(splash!.keys).opacity, 0.3)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { ANIMATED_STICKERS, danceAt } from '../animatedStickers.js';
import { DANCES } from '../winkDances.js';
import { WINK_ART } from '../winkArt.js';
import { danceToLottie, LOTTIE_FPS, LOTTIE_SIZE, squashSteps, stageOf, stepsTrack, trailed, type LottieAnimation, type LottieLayer } from './rigToLottie.js';

type Key = { t: number; s: number[]; o?: { y: number[] }; i?: { y: number[] } };

/** A Lottie property at a frame, the way a player reads it (x handles are 1/3 and 2/3, so time runs linear). */
function valueAt(property: { a: number; k: unknown }, frame: number): number[] {
  if (property.a === 0) return ([] as number[]).concat(property.k as number | number[]);
  const keys = property.k as Key[];
  const next = keys.findIndex((key) => key.t >= frame);
  if (next <= 0) return keys[Math.max(next, 0)]!.s;
  const from = keys[next - 1]!;
  const to = keys[next]!;
  const share = (frame - from.t) / (to.t - from.t);
  const y1 = from.o!.y[0]!;
  const y2 = from.i!.y[0]!;
  const eased = 3 * share * (1 - share) ** 2 * y1 + 3 * share ** 2 * (1 - share) * y2 + share ** 3;
  return from.s.map((value, index) => value + (to.s[index]! - value) * eased);
}

const layerNamed = (animation: LottieAnimation, name: string): LottieLayer => animation.layers.find((layer) => layer.nm === name)!;
const noShapes = () => [];

describe('a wink dance as Lottie (José 11/11, like Telegram)', () => {
  it('is a 512 px square at 60 fps that lasts one loop of the dance', () => {
    const animation = danceToLottie({ name: 'piggy-disco', art: WINK_ART.piggy, dance: DANCES.disco, shapesOf: noShapes });
    expect([animation.w, animation.h, animation.fr]).toEqual([LOTTIE_SIZE, LOTTIE_SIZE, LOTTIE_FPS]);
    expect(animation.op).toBe(Math.round((DANCES.disco.loopMs / 1000) * 60));
  });

  it('moves every part exactly like the WebP did (danceAt), in every animated sticker', () => {
    for (const sticker of ANIMATED_STICKERS) {
      const dance = DANCES[sticker.dance];
      const animation = danceToLottie({ name: sticker.slug, art: WINK_ART[sticker.character], dance, shapesOf: noShapes });
      for (const share of [0, 0.13, 0.37, 0.5, 0.81, 1]) {
        const pose = danceAt(dance, share);
        const frame = share * animation.op;
        for (const [part, turn] of Object.entries(pose.parts)) {
          if (part === 'head' || part === 'tail') continue;
          const layer = animation.layers.find((candidate) => candidate.nm === part);
          if (layer) expect(valueAt(layer.ks.r, frame)[0]).toBeCloseTo(turn, 6);
        }
        const whole = layerNamed(animation, 'whole');
        expect(valueAt(whole.ks.p, frame)).toEqual([expect.closeTo(120 + pose.whole.x, 6), expect.closeTo(160 + pose.whole.y, 6)]);
        expect(valueAt(whole.ks.r, frame)[0]).toBeCloseTo(pose.whole.rotate, 6);
      }
    }
  });

  it('paints like the SVG: the last part drawn is the top layer, face parts hang from the head', () => {
    const art = WINK_ART.piggy;
    const animation = danceToLottie({ name: 'piggy', art, dance: DANCES.wave, shapesOf: noShapes });
    const roots = art.parts.filter((part) => !part.parent);
    expect(animation.layers[0]!.nm).toBe(art.parts.filter((part) => part.parent === roots.at(-1)!.part).at(-1)?.part ?? roots.at(-1)!.part);
    for (const part of art.parts.filter((candidate) => candidate.parent)) {
      const parent = layerNamed(animation, part.parent!);
      expect(layerNamed(animation, part.part).parent).toBe(parent.ind);
    }
    expect(animation.layers.slice(-3).map((layer) => layer.nm).sort()).toEqual(['squash', 'stage', 'whole']);
    expect(animation.layers).toHaveLength(art.parts.length + 3);
  });

  it('fits the stage in the 512 px square, including the highest jump', () => {
    const stage = stageOf(DANCES.clap);
    const animation = danceToLottie({ name: 'bear-clap', art: WINK_ART.bear, dance: DANCES.clap, shapesOf: noShapes });
    expect(valueAt(layerNamed(animation, 'stage').ks.s, 0)).toEqual([(LOTTIE_SIZE / stage.side) * 100, (LOTTIE_SIZE / stage.side) * 100]);
    expect(stage.y).toBeLessThan(-34);
  });

  it('phase 2: the head and the tail trail the body by 3 frames, and the loop still closes', () => {
    for (const sticker of ANIMATED_STICKERS) {
      const dance = DANCES[sticker.dance];
      const animation = danceToLottie({ name: sticker.slug, art: WINK_ART[sticker.character], dance, shapesOf: noShapes });
      for (const part of ['head', 'tail'] as const) {
        const layer = animation.layers.find((candidate) => candidate.nm === part);
        const steps = dance.parts[part]?.rotate;
        if (!layer || !steps || steps.length < 2) continue;
        expect(valueAt(layer.ks.r, 0)[0]).toBeCloseTo(valueAt(layer.ks.r, animation.op)[0]!, 6);
        steps.forEach((value, index) => {
          const frame = (index / (steps.length - 1)) * animation.op + 3;
          if (index > 0 && frame < animation.op) expect(valueAt(layer.ks.r, frame)[0]).toBeCloseTo(value, 6);
        });
      }
    }
  });

  it('phase 2: a jump stretches in the air and squashes before and after; a dance on the ground does not', () => {
    expect(squashSteps(DANCES.clap.whole?.y)).toEqual([[100, 100], [100, 100], [100, 100], [100, 100], [100, 100], [100, 100], [108, 92], [94, 107], [108, 92]]);
    expect(squashSteps(DANCES.cumbia.whole?.y)).toEqual([[100, 100]]);
    expect(squashSteps(undefined)).toEqual([[100, 100]]);
  });

  it('a track that does not move is not trailed', () => {
    expect(trailed({ a: 0, k: [3] }, 120, 3)).toEqual({ a: 0, k: [3] });
  });

  it('a part that does not move is a constant, not a keyframe list', () => {
    expect(stepsTrack([[5]], 120)).toEqual({ a: 0, k: [5] });
    expect(stepsTrack([], 120)).toEqual({ a: 0, k: [0] });
  });

  it('hands each part its own SVG markup to turn into shapes', () => {
    const seen: string[] = [];
    danceToLottie({ name: 'x', art: WINK_ART.cone, dance: DANCES.jump, shapesOf: (markup) => (seen.push(markup), []) });
    expect(seen).toHaveLength(WINK_ART.cone.parts.length);
    expect(seen).toContain(WINK_ART.cone.parts[0]!.markup);
  });
});

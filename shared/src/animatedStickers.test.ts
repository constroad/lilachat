import { describe, expect, it } from 'vitest';
import { DANCES } from './winkDances.js';
import { WINK_ART } from './winkArt.js';
import { ANIMATED_STICKERS, ANIMATED_STICKER_FPS, animatedStickerFrames, danceAt, isAnimatedSticker, stickerIsAnimated } from './animatedStickers.js';
import { STICKER_PACKS, findPackSticker } from './stickers.js';

/** Backlog 31 (José, 21/10): stickers with movement, from the same characters and dances as the winks. */
describe('danceAt', () => {
  it('rests at the start and comes back to the same pose at the end: the loop has no jump', () => {
    for (const dance of Object.values(DANCES)) {
      expect(danceAt(dance, 0)).toEqual(danceAt(dance, 1));
    }
  });
  it('passes through each step of the dance, eased in between', () => {
    const { wave } = DANCES;
    const steps = wave.parts['arm-right']!.rotate!;
    const stepShare = 1 / (steps.length - 1);
    expect(danceAt(wave, stepShare).parts['arm-right']).toBeCloseTo(steps[1]!);
    const halfway = danceAt(wave, stepShare / 2).parts['arm-right']!;
    expect(halfway).toBeCloseTo((steps[0]! + steps[1]!) / 2);
  });
  it('a part the dance does not move is not there; the whole body moves on x and y', () => {
    const frame = danceAt(DANCES.laugh, 0.25);
    expect(frame.whole.x).toBe(0);
    expect(typeof frame.whole.y).toBe('number');
  });
});

describe('the animated pack', () => {
  it('every sticker is a real character with a real dance, slugs unique', () => {
    expect(ANIMATED_STICKERS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ANIMATED_STICKERS.map((one) => one.slug)).size).toBe(ANIMATED_STICKERS.length);
    for (const one of ANIMATED_STICKERS) {
      expect(WINK_ART[one.character]).toBeDefined();
      expect(DANCES[one.dance]).toBeDefined();
    }
  });
  it('is a pack of the catalog, so the server accepts its stickers like any other', () => {
    const pack = STICKER_PACKS.find((one) => one.animated);
    expect(pack?.stickers.map((one) => one.slug)).toEqual(ANIMATED_STICKERS.map((one) => one.slug));
    expect(findPackSticker(`pack:${pack!.id}/${ANIMATED_STICKERS[0]!.slug}`)).toMatchObject({ slug: ANIMATED_STICKERS[0]!.slug });
  });
  it('frames: one loop of the dance at the pack fps, without repeating the first frame at the end', () => {
    const moments = animatedStickerFrames(DANCES.wave.loopMs);
    expect(moments.length).toBe(Math.round((DANCES.wave.loopMs / 1000) * ANIMATED_STICKER_FPS));
    expect(moments[0]).toBe(0);
    expect(moments.at(-1)!).toBeLessThan(1);
  });
});

describe('isAnimatedSticker', () => {
  it('a file of the animated pack, on any server; nothing else', () => {
    expect(isAnimatedSticker('https://lilachat.constroad.com/stickers/lila-mov/panda-hug.webp')).toBe(true);
    expect(isAnimatedSticker('http://localhost:4003/stickers/lila-mov/cone-go.webp')).toBe(true);
    expect(isAnimatedSticker('https://lilachat.constroad.com/stickers/lila-1/ok.webp')).toBe(false);
    expect(isAnimatedSticker('https://lilachat.constroad.com/media/abc.webp')).toBe(false);
    expect(isAnimatedSticker(undefined)).toBe(false);
  });
});

/** Pending 37 (José, 21/10 and 22/10): my own animated stickers stop too. */
describe('stickerIsAnimated', () => {
  it('the pack by its address, mine by its flag; a still one is not', () => {
    expect(stickerIsAnimated({ url: 'https://lilachat.constroad.com/stickers/lila-mov/panda-hug.webp' })).toBe(true);
    expect(stickerIsAnimated({ url: 'https://storage.test/image-2026.webp', animated: true })).toBe(true);
    expect(stickerIsAnimated({ url: 'https://storage.test/image-2026.webp' })).toBe(false);
    expect(stickerIsAnimated(undefined)).toBe(false);
  });
});

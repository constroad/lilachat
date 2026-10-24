import { describe, expect, it } from 'vitest';
import { callReactionOf } from './callReactions.js';
import { STICKER_PACKS, packStickerId } from './stickers.js';
import { WINKS } from './winks.js';

/** Winks and stickers in a call (pending 98). */
describe('a reaction sent during a call', () => {
  it('takes a wink or a pack sticker from the catalog', () => {
    // Arrange
    const wink = WINKS[0]!;
    const pack = STICKER_PACKS[0]!;
    const sticker = packStickerId(pack.id, pack.stickers[0]!.slug);
    // Act + Assert
    expect(callReactionOf({ kind: 'wink', id: wink.id })).toEqual({ kind: 'wink', id: wink.id });
    expect(callReactionOf({ kind: 'sticker', id: sticker })).toEqual({ kind: 'sticker', id: sticker });
  });

  it('refuses anything outside the catalog: an unknown wink, an outside url, another kind, garbage', () => {
    expect(callReactionOf({ kind: 'wink', id: 'nope' })).toBeNull();
    expect(callReactionOf({ kind: 'sticker', id: 'https://evil.example/x.webp' })).toBeNull();
    expect(callReactionOf({ kind: 'gif', id: 'x' })).toBeNull();
    expect(callReactionOf(null)).toBeNull();
    expect(callReactionOf({ kind: 'wink' })).toBeNull();
  });
});

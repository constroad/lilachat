import { describe, expect, it, vi } from 'vitest';
import { CALL_EMOJIS, CALL_REACTION_ACK_MS, callReactionOf, createAckWatch, reactionKeyOf, reactionNotSeenNotice } from './callReactions.js';
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

/** Pending 78 (José, 23/10): quick effects over the call, like WhatsApp's. */
describe('an emoji effect during a call', () => {
  it('takes the six effects of the bar and nothing else', () => {
    for (const emoji of CALL_EMOJIS) expect(callReactionOf({ kind: 'emoji', id: emoji })).toEqual({ kind: 'emoji', id: emoji });
    expect(callReactionOf({ kind: 'emoji', id: '💩' })).toBeNull();
    expect(callReactionOf({ kind: 'emoji', id: '<img src=x>' })).toBeNull();
  });
});

/**
 * Pending 105b (José, 28/10): Lila did not see the winks José sent, and he had
 * no way to know. Each reaction carries a key; the other side answers «seen»;
 * without it in a few seconds, the sender is told.
 */
describe('the delivery of a reaction', () => {
  it('a key is short and plain; anything else travels without one', () => {
    expect(reactionKeyOf('k-1730000000000')).toBe('k-1730000000000');
    expect(reactionKeyOf('x'.repeat(41))).toBeNull();
    expect(reactionKeyOf('a b')).toBeNull();
    expect(reactionKeyOf(42)).toBeNull();
  });

  it('seen in time: no notice; not seen: one notice, after the wait', () => {
    vi.useFakeTimers();
    const missed = vi.fn();
    const watch = createAckWatch(missed);

    watch.sent('k1');
    watch.seen('k1');
    vi.advanceTimersByTime(CALL_REACTION_ACK_MS + 1);
    expect(missed).not.toHaveBeenCalled();

    watch.sent('k2');
    vi.advanceTimersByTime(CALL_REACTION_ACK_MS - 1);
    expect(missed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(missed).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('stopping (the call ended) cancels what was waiting', () => {
    vi.useFakeTimers();
    const missed = vi.fn();
    const watch = createAckWatch(missed);
    watch.sent('k1');
    watch.stop();
    vi.advanceTimersByTime(CALL_REACTION_ACK_MS * 2);
    expect(missed).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('the notice names the other and says what to do', () => {
    expect(reactionNotSeenNotice('Lila')).toBe('Lila no lo recibió. Puede que tenga que actualizar Lilachat.');
  });
});

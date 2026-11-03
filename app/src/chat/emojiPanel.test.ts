import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-reanimated', () => ({
  makeMutable: (value: number | boolean) => ({ value }),
  withTiming: (target: number) => target,
  Easing: { out: () => 0, cubic: 0 },
}));

const { closeEmojiPanel, isEmojiPanelOpen, openEmojiPanel, resetEmojiPanel, subscribeEmojiPanel } = await import('./emojiPanel');

/**
 * Plan 1, F4 (02/11): the sticker recents and the «follow the end» of the list
 * only react to the panel closing. Subscribed without a render, closing the
 * panel with a wink no longer redraws the sticker grid nor the message list.
 */
describe('subscribeEmojiPanel', () => {
  it('tells each opening and closing once', () => {
    resetEmojiPanel();
    const seen: boolean[] = [];
    const leave = subscribeEmojiPanel(() => seen.push(isEmojiPanelOpen()));
    openEmojiPanel(false);
    closeEmojiPanel(false);
    leave();
    expect(seen).toEqual([true, false]);
  });

  it('says nothing when the state does not change (a second close, a reset while closed)', () => {
    resetEmojiPanel();
    const listener = vi.fn();
    const leave = subscribeEmojiPanel(listener);
    closeEmojiPanel(false);
    resetEmojiPanel();
    leave();
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops telling once left', () => {
    resetEmojiPanel();
    const listener = vi.fn();
    subscribeEmojiPanel(listener)();
    openEmojiPanel(true);
    closeEmojiPanel(true);
    expect(listener).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { useFunPlayback } from './nudge';

vi.mock('./winkSounds', () => ({ playWinkCues: () => () => undefined, playWinkSound: vi.fn(), shakeWholeScreen: vi.fn(), stopWinkSounds: vi.fn() }));

const wink = (chatId: string, seq: number, senderId: string) => ({ chatId, seq, senderId, kind: 'guino', wink: 'piggy', at: '2026-10-21T23:48:08.805Z' });

function overlayFor(params: Parameters<typeof useFunPlayback>[0]) {
  const { result } = renderHook(() => useFunPlayback(params));
  render(<>{result.current.overlay}</>);
}

// jsdom has no Web Animations: the overlay only needs a handle it can cancel.
Element.prototype.animate = function animate() {
  return { cancel: () => undefined, finish: () => undefined, finished: new Promise(() => undefined), onfinish: null } as unknown as Animation;
};

afterEach(cleanup);

/** José, 21/10: opening «Developers Lila» played Wilson's pig from their 1:1. */
describe('fun playback when switching chats', () => {
  it('a wink from someone else after what I had read plays when the chat opens', () => {
    overlayFor({ messages: [wink('wilson', 227, 'w')], me: 'yo', chatId: 'wilson', muted: false, afterSeq: 200 });
    expect(screen.queryByTestId('guino-en-pantalla-piggy')).not.toBeNull();
  });

  it("the previous chat's messages, still on screen for a render, never play in the new chat", () => {
    overlayFor({ messages: [wink('wilson', 227, 'w')], me: 'yo', chatId: 'developers', muted: false, afterSeq: 73 });
    expect(screen.queryByTestId('guino-en-pantalla-piggy')).toBeNull();
  });
});

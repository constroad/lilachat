import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { CALL_REACTION_ACK_MS } from '@lilachat/shared';
import { useCallReactions } from './CallReactions';

type Handler = (frame: never) => unknown;
const sent: { event: string; frame: Record<string, unknown> }[] = [];
const handlers = new Map<string, Handler>();
const socket = {
  on: (event: string, handler: Handler) => void handlers.set(event, handler),
  off: (event: string) => void handlers.delete(event),
  emit: (event: string, frame: Record<string, unknown>) => void sent.push({ event, frame }),
};
vi.mock('../useSocket', () => ({ currentSocket: () => socket }));

afterEach(() => {
  sent.length = 0;
  vi.useRealTimers();
});

/** Pending 105b and 78 on the web: the key, the «seen» back, the notice, and the emoji effects. */
describe('useCallReactions', () => {
  it('sends with a key; without «seen» in time it says the other did not get it', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCallReactions('c1', 'Lila'));
    act(() => result.current.send({ kind: 'emoji', id: '🎉' }));
    const frame = sent.find((one) => one.event === 'call.reaction')?.frame;
    expect(frame).toMatchObject({ chatId: 'c1', reaction: { kind: 'emoji', id: '🎉' } });
    expect(typeof frame?.key).toBe('string');
    act(() => void vi.advanceTimersByTime(CALL_REACTION_ACK_MS + 1));
    expect(result.current.notice).toBe('Lila no lo recibió. Puede que tenga que actualizar Lilachat.');
  });

  it('with «seen» in time there is no notice; an arriving reaction is answered with «seen»', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCallReactions('c1', 'Lila'));
    act(() => result.current.send({ kind: 'emoji', id: '👍' }));
    const key = sent.find((one) => one.event === 'call.reaction')?.frame.key;
    act(() => void handlers.get('call.reaction.ack')?.({ chatId: 'c1', key } as never));
    act(() => void vi.advanceTimersByTime(CALL_REACTION_ACK_MS + 1));
    expect(result.current.notice).toBeNull();

    act(() => void handlers.get('call.reaction')?.({ chatId: 'c1', reaction: { kind: 'emoji', id: '❤️' }, key: 'k-9' } as never));
    expect(result.current.played?.reaction).toEqual({ kind: 'emoji', id: '❤️' });
    expect(sent.at(-1)).toEqual({ event: 'call.reaction.ack', frame: { chatId: 'c1', key: 'k-9' } });
  });
});

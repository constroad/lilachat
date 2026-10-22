import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMessageWindow } from './useMessageWindow';

const message = (seq: number, extra: Record<string, unknown> = {}) => ({ chatId: 'c1', seq, senderId: seq % 2 ? 'yo' : 'ana', clientKey: `k${seq}`, kind: 'text', body: `m${seq}`, at: '2026-10-22T12:00:00.000Z', ...extra });
const page = (from: number, to: number, flags: Record<string, boolean>) => new Response(JSON.stringify({ messages: Array.from({ length: to - from + 1 }, (_, index) => message(from + index)), lastSeq: 500, ...flags }), { status: 200 });

afterEach(() => vi.restoreAllMocks());

/** Pending 44 (José, 22/10): an old message opens with its context instead of «sube para cargarlo». */
describe('useMessageWindow (web)', () => {
  it('asks for the window around the message and shows it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(page(75, 124, { hasOlder: true, hasNewer: true }));
    const { result } = renderHook(() => useMessageWindow('jwt', 'c1'));
    let status = '';
    await act(async () => {
      status = (await result.current.jumpTo(100)).status;
    });
    expect(status).toBe('shown');
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/chats/c1/messages?around=100&limit=50');
    expect(result.current.window?.messages[0]?.seq).toBe(75);
  });

  it('pages down from the last and up from the first', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(page(75, 124, { hasOlder: true, hasNewer: true })).mockResolvedValueOnce(page(125, 174, { hasNewer: true })).mockResolvedValueOnce(page(25, 74, {}));
    const { result } = renderHook(() => useMessageWindow('jwt', 'c1'));
    await act(async () => void (await result.current.jumpTo(100)));
    await act(async () => void (await result.current.loadNewer()));
    expect(String(fetchMock.mock.calls[1]![0])).toBe('/api/chats/c1/messages?afterSeq=124&limit=50');
    await act(async () => void (await result.current.loadOlder()));
    expect(String(fetchMock.mock.calls[2]![0])).toBe('/api/chats/c1/messages?beforeSeq=75&limit=50');
    expect(result.current.window?.messages.map((one) => one.seq).at(0)).toBe(25);
    expect(result.current.window?.messages.map((one) => one.seq).at(-1)).toBe(174);
  });

  it('a thread reply opens its thread, a missing message says so, and «Ir al último» closes the window', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ messages: [message(99), message(100, { hiloDe: 90 })], lastSeq: 500, hasOlder: true, hasNewer: true }), { status: 200 })).mockResolvedValueOnce(page(1, 4, { hasOlder: false, hasNewer: true })).mockResolvedValueOnce(page(75, 124, { hasOlder: true, hasNewer: true }));
    const { result } = renderHook(() => useMessageWindow('jwt', 'c1'));
    let outcome: Awaited<ReturnType<typeof result.current.jumpTo>> = { status: 'error' };
    await act(async () => void (outcome = await result.current.jumpTo(100)));
    expect(outcome).toEqual({ status: 'thread', root: 90 });
    expect(result.current.window).toBeNull();
    await act(async () => void (outcome = await result.current.jumpTo(9)));
    expect(outcome.status).toBe('missing');
    await act(async () => void (await result.current.jumpTo(100)));
    act(() => result.current.close());
    expect(result.current.window).toBeNull();
  });

  it('without network it says so and opens nothing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useMessageWindow('jwt', 'c1'));
    let status = '';
    await act(async () => void (status = (await result.current.jumpTo(100)).status));
    expect(status).toBe('error');
    expect(result.current.window).toBeNull();
  });
});

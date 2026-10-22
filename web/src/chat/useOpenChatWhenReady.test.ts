import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOpenChatWhenReady } from './useOpenChatWhenReady';

/**
 * 22/10: reloading on `/c/<chat>` mounted the shell before the session token
 * came back; the chat's page was asked without a token (nothing asked) and
 * never again, so a chat this browser had not cached stayed empty.
 */
describe('open the chat when the session is ready', () => {
  it('waits for the token, then opens the chat of the address once', () => {
    const open = vi.fn();
    const { rerender } = renderHook((props: { chatId: string | null; ready: boolean }) => useOpenChatWhenReady({ ...props, open }), { initialProps: { chatId: 'c1', ready: false } });
    expect(open).not.toHaveBeenCalled();
    rerender({ chatId: 'c1', ready: true });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('c1');
    rerender({ chatId: 'c1', ready: true });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('a chat opened with the session already there opens at once; another chat opens again; none, nothing', () => {
    const open = vi.fn();
    const { rerender } = renderHook((props: { chatId: string | null; ready: boolean }) => useOpenChatWhenReady({ ...props, open }), { initialProps: { chatId: null as string | null, ready: true } });
    expect(open).not.toHaveBeenCalled();
    rerender({ chatId: 'c1', ready: true });
    rerender({ chatId: 'c2', ready: true });
    expect(open.mock.calls).toEqual([['c1'], ['c2']]);
  });

  it('a renewed token (same session) does not open the same chat again', () => {
    const open = vi.fn();
    const { rerender } = renderHook((props: { chatId: string | null; ready: boolean }) => useOpenChatWhenReady({ ...props, open }), { initialProps: { chatId: 'c1', ready: true } });
    rerender({ chatId: 'c1', ready: true });
    expect(open).toHaveBeenCalledTimes(1);
  });
});

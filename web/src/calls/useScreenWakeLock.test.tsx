import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScreenWakeLock } from './useScreenWakeLock';

type FakeLock = { released: boolean; release: ReturnType<typeof vi.fn> };

/** José, 04/11: a video call does not let the screen lock, on the web too. */
describe('useScreenWakeLock', () => {
  let locks: FakeLock[];
  let request: ReturnType<typeof vi.fn>;
  const settle = () => act(async () => { await Promise.resolve(); });

  const setVisibility = (state: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    locks = [];
    request = vi.fn(async () => {
      const lock: FakeLock = { released: false, release: vi.fn(async () => { lock.released = true; }) };
      locks.push(lock);
      return lock;
    });
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('holds the screen while active and lets it go after', async () => {
    const { rerender } = renderHook(({ active }) => useScreenWakeLock(active), { initialProps: { active: true } });
    await settle();
    expect(request).toHaveBeenCalledWith('screen');

    rerender({ active: false });
    await settle();
    expect(locks[0]?.release).toHaveBeenCalled();
  });

  it('asks nothing while it is not active', async () => {
    renderHook(() => useScreenWakeLock(false));
    await settle();
    expect(request).not.toHaveBeenCalled();
  });

  it('the browser drops it when the tab hides: coming back asks again', async () => {
    renderHook(() => useScreenWakeLock(true));
    await settle();
    locks[0]!.released = true;

    act(() => setVisibility('hidden'));
    await settle();
    expect(request).toHaveBeenCalledTimes(1);

    act(() => setVisibility('visible'));
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('a lock that arrives after the call ended is let go at once', async () => {
    const { unmount } = renderHook(() => useScreenWakeLock(true));
    unmount();
    await settle();
    expect(locks[0]?.release).toHaveBeenCalled();
  });

  it('a browser without it, or one that refuses, does not touch the call', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    request.mockRejectedValueOnce(new Error('NotAllowedError'));
    renderHook(() => useScreenWakeLock(true));
    await settle();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();

    Reflect.deleteProperty(navigator, 'wakeLock');
    expect(() => renderHook(() => useScreenWakeLock(true))).not.toThrow();
  });
});

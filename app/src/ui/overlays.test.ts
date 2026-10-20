import { describe, expect, it, vi } from 'vitest';
import { coveredAbove, openOverlay, openOverlays, subscribeOverlays } from './overlays';

describe('overlays', () => {
  it('counts open modals and releases each one once', () => {
    const before = openOverlays();
    const releaseThread = openOverlay();
    const releaseSheet = openOverlay();
    expect(openOverlays()).toBe(before + 2);

    releaseSheet();
    releaseSheet();
    expect(openOverlays()).toBe(before + 1);

    releaseThread();
    expect(openOverlays()).toBe(before);
  });

  it('notifies subscribers on every change until they leave', () => {
    const listener = vi.fn();
    const leave = subscribeOverlays(listener);
    const release = openOverlay();
    release();
    expect(listener).toHaveBeenCalledTimes(2);

    leave();
    openOverlay()();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('covers a list only with a modal above its own level', () => {
    // The chat (level 0) with the thread open: covered.
    expect(coveredAbove(0, 1)).toBe(true);
    // The thread list (inside one modal) with nothing above it: not covered.
    expect(coveredAbove(1, 1)).toBe(false);
    // A reactions sheet over the thread: the thread is covered too.
    expect(coveredAbove(1, 2)).toBe(true);
    expect(coveredAbove(0, 0)).toBe(false);
  });
});

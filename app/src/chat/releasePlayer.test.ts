import { describe, expect, it, vi } from 'vitest';
import { releasePlayer } from './releasePlayer';

/** José, 22/10: closing the voice note's card left the audio playing. */
describe('releasing the voice note player', () => {
  it('pauses first, then drops the lock-screen controls and the player', () => {
    const calls: string[] = [];
    releasePlayer({ pause: () => calls.push('pause'), clearLockScreenControls: () => calls.push('controls'), remove: () => calls.push('remove') }, () => undefined);
    expect(calls).toEqual(['pause', 'controls', 'remove']);
  });

  it('a step that fails does not keep the others from running', () => {
    const report = vi.fn();
    const remove = vi.fn();
    releasePlayer({ pause: () => { throw new Error('ya liberado'); }, clearLockScreenControls: () => undefined, remove }, report);
    expect(remove).toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(1);
  });
});

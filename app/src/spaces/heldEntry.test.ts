import { describe, expect, it } from 'vitest';
import { entryWhileHeld } from './heldEntry';

/**
 * Plan 1, F4: with a chat on top, the space list re-rendered with every message
 * of that chat (2 renders, 207 ms of JS when sending a wink on the emulator).
 * React Navigation does not freeze the screen right below on Fabric.
 */
describe('entryWhileHeld', () => {
  const first = { value: 1 };
  const second = { value: 2 };

  it('keeps showing what was shown while held: the update stays in the cache', () => {
    expect(entryWhileHeld(true, { key: 'a', entry: first }, 'a', second)).toEqual({ key: 'a', entry: first });
  });

  it('shows the latest entry once released', () => {
    expect(entryWhileHeld(false, { key: 'a', entry: first }, 'a', second)).toEqual({ key: 'a', entry: second });
  });

  it('shows the latest entry when nothing was shown yet, even held', () => {
    expect(entryWhileHeld(true, null, 'a', second)).toEqual({ key: 'a', entry: second });
  });

  it('never holds the entry of another key (the space changed)', () => {
    expect(entryWhileHeld(true, { key: 'a', entry: first }, 'b', second)).toEqual({ key: 'b', entry: second });
  });

  it('returns the very same object while held, so the store does not re-render', () => {
    const shown = { key: 'a', entry: first };
    expect(entryWhileHeld(true, shown, 'a', second)).toBe(shown);
  });
});

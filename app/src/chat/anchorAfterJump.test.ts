import { describe, expect, it } from 'vitest';
import { ANCHOR_MS, anchorFor, anchoredIndex } from './anchorAfterJump';

const rows = [{ seq: 30 }, { seq: 33 }, { seq: 37 }];
const indexOf = (seq: number) => rows.findIndex((row) => row.seq === seq);

/**
 * B4 E2E (28/10/2026): a notice tapped with the app closed opened #planta at its message,
 * highlighted, and two seconds later the list jumped up and hid it: the bot cards above
 * were measured late (names and rich cards resolve after a cold start).
 */
describe('anchoredIndex', () => {
  it('gives the target row while the anchor lasts', () => {
    const anchor = anchorFor(37, 1_000);
    expect(anchoredIndex(anchor, 1_000 + ANCHOR_MS - 1, indexOf)).toBe(2);
  });

  it('follows the target when rows arrived before it (the index of the jump went stale)', () => {
    const anchor = anchorFor(37, 1_000);
    const grown = [{ seq: 1 }, { seq: 2 }, ...rows];
    expect(anchoredIndex(anchor, 2_000, (seq) => grown.findIndex((row) => row.seq === seq))).toBe(4);
  });

  it('still holds at the exact last millisecond', () => {
    expect(anchoredIndex(anchorFor(33, 0), ANCHOR_MS, indexOf)).toBe(1);
  });

  it('lets go once the time passed', () => {
    expect(anchoredIndex(anchorFor(37, 0), ANCHOR_MS + 1, indexOf)).toBeNull();
  });

  it('lets go when there is no anchor (dropped by a drag, or no jump)', () => {
    expect(anchoredIndex(null, 0, indexOf)).toBeNull();
  });

  it('lets go when the target row is no longer in the list', () => {
    expect(anchoredIndex(anchorFor(99, 0), 10, indexOf)).toBeNull();
  });
});

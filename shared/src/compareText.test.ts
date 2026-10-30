import { describe, expect, it, vi } from 'vitest';
import { compareNames, compareOrdinal } from './compareText.js';

/** Hermes builds a new Intl.Collator per localeCompare: the space list ran out of memory (José, 30/10, OOM in Collator). */
describe('compareNames and compareOrdinal', () => {
  it('sorts Spanish names (ñ after n, accents next to their letter) and ISO dates or ids by code point', () => {
    expect(['Ñandú', 'Nora', 'Álvaro', 'Zoe', 'ana'].sort(compareNames)).toEqual(['Álvaro', 'ana', 'Nora', 'Ñandú', 'Zoe']);
    expect(['2026-10-30T11:00:00Z', '2026-01-01T00:00:00Z', '2026-10-30T09:00:00Z'].sort(compareOrdinal)).toEqual(['2026-01-01T00:00:00Z', '2026-10-30T09:00:00Z', '2026-10-30T11:00:00Z']);
    expect(compareOrdinal('a', 'a')).toBe(0);
  });

  it('builds the collator once, however many comparisons', () => {
    const spy = vi.spyOn(Intl, 'Collator');
    const names = Array.from({ length: 500 }, (_, index) => `Cliente ${index}`);
    names.sort(compareNames);
    names.sort(compareNames);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(1);
    spy.mockRestore();
  });

  it('the loose variant ignores case and accents', async () => {
    const { compareNamesLoose } = await import('./compareText.js');
    expect(compareNamesLoose('José', 'jose')).toBe(0);
  });
});

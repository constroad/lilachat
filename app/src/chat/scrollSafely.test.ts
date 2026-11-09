import { describe, expect, it, vi } from 'vitest';
import type { FlatList } from 'react-native';
import { scrollFlatListTo, scrollWithinRows } from './scrollSafely';

/** José 09/11, report 3921979f: «scrollToIndex out of range: requested index 4 is out of 0 to 0». */
describe('scrollSafely', () => {
  const listWith = (count: number) => {
    const scrollToIndex = vi.fn();
    return { list: { props: { data: Array.from({ length: count }) }, scrollToIndex } as unknown as FlatList<unknown>, scrollToIndex };
  };
  it('jumps to a row the list holds', () => {
    const { list, scrollToIndex } = listWith(5);
    expect(scrollFlatListTo(list, { index: 4, animated: false })).toBe(true);
    expect(scrollToIndex).toHaveBeenCalledWith({ index: 4, animated: false });
  });
  it('does nothing when the list shrank to one row, as in the report', () => {
    const { list, scrollToIndex } = listWith(1);
    expect(scrollFlatListTo(list, { index: 4, animated: false })).toBe(false);
    expect(scrollToIndex).not.toHaveBeenCalled();
  });
  it('does nothing without a list, and checks the known rows of a FlashList', () => {
    expect(scrollFlatListTo(null, { index: 0 })).toBe(false);
    const scrollToIndex = vi.fn();
    expect(scrollWithinRows({ scrollToIndex }, { index: 3 }, 2)).toBe(false);
    expect(scrollWithinRows({ scrollToIndex }, { index: 1 }, 2)).toBe(true);
    expect(scrollToIndex).toHaveBeenCalledTimes(1);
  });
});

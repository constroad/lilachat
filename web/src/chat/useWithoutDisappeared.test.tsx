import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWithoutDisappeared } from './useWithoutDisappeared';

const NOW = Date.parse('2026-10-31T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('the clock of disappearing messages (R31/10-B6)', () => {
  it('hides what passed and wakes once, when the next one is due', () => {
    // Arrange
    const rows = [{ seq: 1, disappearsAt: '2026-10-31T11:00:00Z' }, { seq: 2, disappearsAt: '2026-10-31T12:00:30Z' }, { seq: 3 }];
    const { result } = renderHook(() => useWithoutDisappeared(rows));
    // Assert
    expect(result.current?.map((row) => row.seq)).toEqual([2, 3]);
    // Act
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    // Assert
    expect(result.current?.map((row) => row.seq)).toEqual([3]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps null while the chat is still loading, and sets no timer without the timer on', () => {
    const { result } = renderHook(() => useWithoutDisappeared(null));
    expect(result.current).toBeNull();
    renderHook(() => useWithoutDisappeared<{ seq: number; disappearsAt?: string }>([{ seq: 1 }]));
    expect(vi.getTimerCount()).toBe(0);
  });
});

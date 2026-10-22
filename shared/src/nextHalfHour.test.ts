import { describe, expect, it } from 'vitest';
import { nextHalfHour } from './scheduledCall.js';

describe('nextHalfHour', () => {
  it('a scheduled call starts at the next round half hour, at least 15 minutes ahead', () => {
    // Arrange
    const tenTwenty = new Date(2026, 9, 23, 10, 20);
    // Act / Assert
    expect(nextHalfHour(tenTwenty)).toEqual(new Date(2026, 9, 23, 11, 0));
    expect(nextHalfHour(new Date(2026, 9, 23, 10, 5))).toEqual(new Date(2026, 9, 23, 10, 30));
  });

  it('crosses midnight', () => {
    expect(nextHalfHour(new Date(2026, 9, 23, 23, 50))).toEqual(new Date(2026, 9, 24, 0, 30));
  });
});

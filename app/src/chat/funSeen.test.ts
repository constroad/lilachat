import { describe, expect, it } from 'vitest';
import { funSeenFloor, rememberFunSeen } from './funSeen';

describe('funSeenFloor', () => {
  it('a chat seen in this session does not replay its wink with a stale cursor (José, 22/10: Lila\'s bear)', () => {
    // Arrange
    rememberFunSeen('chat-lila', 25);
    // Act
    const floor = funSeenFloor('chat-lila', 19);
    // Assert
    expect(floor).toBe(25);
  });

  it('a chat not seen yet starts from the cursor it opens with', () => {
    expect(funSeenFloor('chat-new', 7)).toBe(7);
  });

  it('a newer cursor (read on another device) wins over what this session saw', () => {
    rememberFunSeen('chat-web', 10);
    expect(funSeenFloor('chat-web', 14)).toBe(14);
  });

  it('never goes back', () => {
    rememberFunSeen('chat-back', 30);
    rememberFunSeen('chat-back', 12);
    expect(funSeenFloor('chat-back', 0)).toBe(30);
  });
});

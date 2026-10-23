import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { receivePresence, receivePresenceSnapshot, usePresenceStatus } from './presenceStatus';

describe('presenceStatus (pending 15)', () => {
  it('the snapshot says who is away or busy, and a frame changes it', () => {
    // Arrange
    const { result } = renderHook(() => usePresenceStatus('ana'));
    // Act
    act(() => receivePresenceSnapshot({ statuses: { ana: 'busy' } }));
    const afterSnapshot = result.current;
    act(() => receivePresence({ userId: 'ana', online: true, status: 'away' }));
    const afterFrame = result.current;
    act(() => receivePresence({ userId: 'ana', online: false }));
    // Assert
    expect(afterSnapshot).toBe('busy');
    expect(afterFrame).toBe('away');
    expect(result.current).toBeUndefined();
  });

  it('online with no word is plain «En línea»', () => {
    const { result } = renderHook(() => usePresenceStatus('beto'));
    act(() => receivePresence({ userId: 'beto', online: true }));
    expect(result.current).toBeUndefined();
  });
});

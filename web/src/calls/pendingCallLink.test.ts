import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catchCallLink, peekPendingCallLink, takePendingCallLink } from './pendingCallLink';

describe('pendingCallLink (pending 42)', () => {
  beforeEach(() => sessionStorage.clear());

  it('catches /llamada/<token>, leaves the address clean and hands it over once', () => {
    // Arrange
    const replaceState = vi.fn();
    // Act
    const token = catchCallLink({ pathname: '/llamada/6ad8b0cf30ce97957f4acc0c-v-abc_DEF-1' }, { replaceState });
    // Assert
    expect(token).toBe('6ad8b0cf30ce97957f4acc0c-v-abc_DEF-1');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(peekPendingCallLink()).toBe(token);
    expect(takePendingCallLink()).toBe(token);
    expect(takePendingCallLink()).toBeNull();
  });

  it('any other address is left alone', () => {
    const replaceState = vi.fn();
    expect(catchCallLink({ pathname: '/unirse/abc' }, { replaceState })).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { catchJoinLink, peekPendingJoin, takePendingJoin } from './pendingJoin';

afterEach(() => sessionStorage.clear());

/** Pending 47 (José, 22/10): a join link opened on the web waits through the sign-in and opens «Unirme» with its code. */
describe('pendingJoin', () => {
  it('catches the code of /unirse/<code>, leaves the address clean, and hands it over once', () => {
    // Arrange
    const replaceState = vi.fn();
    // Act
    const code = catchJoinLink({ pathname: '/unirse/cons7k3p' }, { replaceState });
    // Assert
    expect(code).toBe('CONS-7K3P');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(peekPendingJoin()).toBe('CONS-7K3P');
    expect(takePendingJoin()).toBe('CONS-7K3P');
    expect(takePendingJoin()).toBeNull();
  });

  it('any other address is left alone', () => {
    const replaceState = vi.fn();
    expect(catchJoinLink({ pathname: '/c/abc' }, { replaceState })).toBeNull();
    expect(catchJoinLink({ pathname: '/unirse/xx' }, { replaceState })).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
    expect(peekPendingJoin()).toBeNull();
  });
});

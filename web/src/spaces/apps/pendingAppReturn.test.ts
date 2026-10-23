import { afterEach, describe, expect, it, vi } from 'vitest';
import { catchAppReturn, peekPendingAppReturn, takePendingAppReturn } from './pendingAppReturn';

afterEach(() => sessionStorage.clear());

/** Back from agentes after installing (José, 23/10): the space and the app wait through the sign-in. */
describe('pendingAppReturn', () => {
  it('catches /s/<space>/apps/<client_id>, leaves the address clean, and hands it over once', () => {
    // Arrange
    const replaceState = vi.fn();
    // Act
    const caught = catchAppReturn({ pathname: '/s/6adbb0887ca6f18809904536/apps/lca_inframaq' }, { replaceState });
    // Assert
    expect(caught).toEqual({ spaceId: '6adbb0887ca6f18809904536', clientId: 'lca_inframaq' });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(peekPendingAppReturn()).toEqual(caught);
    expect(takePendingAppReturn()).toEqual(caught);
    expect(takePendingAppReturn()).toBeNull();
  });

  it('any other address is left alone', () => {
    const replaceState = vi.fn();
    expect(catchAppReturn({ pathname: '/unirse/CONS-7K3P' }, { replaceState })).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
    expect(peekPendingAppReturn()).toBeNull();
  });
});

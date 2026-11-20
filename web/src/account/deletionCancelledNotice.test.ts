import { afterEach, describe, expect, it } from 'vitest';
import { rememberIfDeletionCancelled, takeDeletionCancelled } from './deletionCancelledNotice';

/** A sign-in inside the 30 days cancels the deletion; the next screen says so, once. */
describe('deletion cancelled notice', () => {
  afterEach(() => sessionStorage.clear());

  it('is told once after a sign-in that cancelled the deletion', () => {
    // Arrange
    rememberIfDeletionCancelled({ accountDeletionCancelled: true });

    // Act / Assert
    expect(takeDeletionCancelled()).toBe(true);
    expect(takeDeletionCancelled()).toBe(false);
  });

  it('says nothing after a plain sign-in', () => {
    // Arrange
    rememberIfDeletionCancelled({});

    // Act / Assert
    expect(takeDeletionCancelled()).toBe(false);
  });
});

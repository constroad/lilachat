import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_DELETION_CONFIRM_WORD,
  ACCOUNT_DELETION_GRACE_DAYS,
  DELETED_ACCOUNT_NAME,
  accountDeletionDeadline,
  accountDeletionState,
  confirmsAccountDeletion,
  deletionBlockedMessage,
  deletionClosedLine,
  spacesBlockingDeletion,
  type DeletionMembership,
} from './accountDeletion.js';
import { deletedPhoneKey, formatPhoneDisplay, isRealPhone, normalizePeruPhone } from './phone.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const requestedAt = new Date('2026-11-19T15:00:00.000Z');

/** José 19/11: closing the account is instant, erasing it waits 30 days, and signing in again cancels it. */
describe('account deletion clock', () => {
  it('erases the account 30 days after it was asked', () => {
    // Act
    const deadline = accountDeletionDeadline(requestedAt);

    // Assert
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30);
    expect(deadline.getTime() - requestedAt.getTime()).toBe(30 * DAY_MS);
  });

  it('is none without a request, pending inside the grace, due after it and erased once purged', () => {
    // Arrange
    const inside = new Date(requestedAt.getTime() + 29 * DAY_MS);
    const after = new Date(requestedAt.getTime() + 30 * DAY_MS);

    // Act / Assert
    expect(accountDeletionState({}, inside)).toBe('none');
    expect(accountDeletionState({ requestedAt }, inside)).toBe('pending');
    expect(accountDeletionState({ requestedAt }, after)).toBe('due');
    expect(accountDeletionState({ requestedAt, purgedAt: after }, after)).toBe('erased');
  });

  it('reads an unparseable date as no request rather than erasing by mistake', () => {
    // Act
    const state = accountDeletionState({ requestedAt: new Date('nope') }, new Date());

    // Assert
    expect(state).toBe('none');
  });
});

describe('confirming the deletion', () => {
  it('takes the word typed with any case or spaces around it', () => {
    // Act / Assert
    expect(ACCOUNT_DELETION_CONFIRM_WORD).toBe('BORRAR');
    expect(confirmsAccountDeletion(' borrar ')).toBe(true);
    expect(confirmsAccountDeletion('BORRAR')).toBe(true);
  });

  it('refuses anything else, an empty text or a non-text', () => {
    // Act / Assert
    expect(confirmsAccountDeletion('borra')).toBe(false);
    expect(confirmsAccountDeletion('')).toBe(false);
    expect(confirmsAccountDeletion(undefined)).toBe(false);
    expect(confirmsAccountDeletion(42)).toBe(false);
  });
});

describe('spaces that block the deletion', () => {
  const space = (overrides: Partial<DeletionMembership>): DeletionMembership => ({ spaceName: 'Constroad', role: 'member', otherActiveMembers: 3, otherManagers: 1, ...overrides });

  it('blocks the owner of a space that has other people', () => {
    // Act
    const blocking = spacesBlockingDeletion([space({ role: 'owner', otherManagers: 0 })]);

    // Assert
    expect(blocking).toEqual(['Constroad']);
  });

  it('blocks the only admin left among other people', () => {
    // Act
    const blocking = spacesBlockingDeletion([space({ spaceName: 'Globofast', role: 'admin', otherManagers: 0 })]);

    // Assert
    expect(blocking).toEqual(['Globofast']);
  });

  it('lets a member, an admin with another admin, or an owner alone in the space go', () => {
    // Act
    const blocking = spacesBlockingDeletion([
      space({ role: 'member', otherManagers: 0 }),
      space({ role: 'admin', otherManagers: 1 }),
      space({ role: 'owner', otherActiveMembers: 0, otherManagers: 0 }),
    ]);

    // Assert
    expect(blocking).toEqual([]);
  });

  it('names every blocking space in the message, and the way out', () => {
    // Act
    const message = deletionBlockedMessage(['Constroad', 'Globofast']);

    // Assert
    expect(message).toContain('«Constroad» y «Globofast»');
    expect(message).toContain('Pasa el espacio a otra persona');
    expect(message).toContain('elimínalo');
  });
});

describe('texts', () => {
  it('says when the account goes, in Lima time, and how to keep it', () => {
    // Act
    const line = deletionClosedLine(accountDeletionDeadline(requestedAt));

    // Assert
    expect(line).toContain('19 dic. 2026');
    expect(line).toContain('código');
  });

  it('signs what stays as «Cuenta eliminada»', () => {
    // Assert
    expect(DELETED_ACCOUNT_NAME).toBe('Cuenta eliminada');
  });
});

describe('the phone key of an erased account', () => {
  it('is unique per account, never a real phone, and shows nothing', () => {
    // Arrange
    const key = deletedPhoneKey('65a1f0c9e4b0a1234567890b');

    // Act / Assert
    expect(key).toBe('deleted:65a1f0c9e4b0a1234567890b');
    expect(isRealPhone(key)).toBe(false);
    expect(normalizePeruPhone(key)).toBe('');
    expect(formatPhoneDisplay(key)).toBe('');
  });
});

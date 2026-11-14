import { describe, expect, it } from 'vitest';
import { BIRTHDAY_REMINDER_SNOOZE_DAYS, birthdayReminderKey, readReminderDismissal, shouldRemindBirthday } from './birthdayReminder.js';

const NOW = Date.parse('2026-11-14T15:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/** José, 14/11: people invited by email never wrote their birthday; a card reminds them, without nagging. */
describe('birthday reminder', () => {
  it('shows when the server says the birthday is missing and it was never dismissed', () => {
    // Arrange
    const input = { birthdayMissing: true, dismissedAt: null, now: NOW };
    // Act
    const shown = shouldRemindBirthday(input);
    // Assert
    expect(shown).toBe(true);
  });

  it('never shows once the birthday is set, nor for an older server that does not say', () => {
    expect(shouldRemindBirthday({ birthdayMissing: false, dismissedAt: null, now: NOW })).toBe(false);
    expect(shouldRemindBirthday({ birthdayMissing: undefined, dismissedAt: null, now: NOW })).toBe(false);
  });

  it('«Ahora no» keeps it away for the snooze days, then it comes back', () => {
    const snooze = BIRTHDAY_REMINDER_SNOOZE_DAYS * DAY_MS;
    expect(shouldRemindBirthday({ birthdayMissing: true, dismissedAt: NOW - snooze + 1, now: NOW })).toBe(false);
    expect(shouldRemindBirthday({ birthdayMissing: true, dismissedAt: NOW - snooze, now: NOW })).toBe(true);
  });

  it('a dismissal in the future (the clock moved back) does not hide it forever', () => {
    expect(shouldRemindBirthday({ birthdayMissing: true, dismissedAt: NOW + DAY_MS, now: NOW })).toBe(true);
  });

  it('reads the stored dismissal; anything unreadable counts as never dismissed', () => {
    expect(readReminderDismissal(String(NOW))).toBe(NOW);
    expect(readReminderDismissal(null)).toBeNull();
    expect(readReminderDismissal('')).toBeNull();
    expect(readReminderDismissal('ayer')).toBeNull();
    expect(readReminderDismissal('-5')).toBeNull();
  });

  it('remembered per person on the device', () => {
    expect(birthdayReminderKey('u1')).not.toBe(birthdayReminderKey('u2'));
  });
});

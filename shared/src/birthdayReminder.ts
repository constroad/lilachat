/**
 * The card that reminds someone to add their birthday (José, 14/11): people
 * invited to a space by email only wrote their name, so their birthday never
 * reached the group's greetings. It shows while the server says the birthday
 * is missing; «Ahora no» hides it on this device for a few days, so it reminds
 * without nagging. PURE: the app and the web keep the dismissal on the device.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** How long «Ahora no» keeps the reminder away. */
export const BIRTHDAY_REMINDER_SNOOZE_DAYS = 7;
const SNOOZE_MS = BIRTHDAY_REMINDER_SNOOZE_DAYS * DAY_MS;

/** Where the device remembers when this person dismissed it. */
export const birthdayReminderKey = (userId: string): string => `lilachat.birthday-reminder.${userId}`;

/** The stored dismissal time; anything unreadable counts as never dismissed. */
export function readReminderDismissal(raw: string | null): number | null {
  if (!raw) return null;
  const at = Number(raw);
  return Number.isFinite(at) && at > 0 ? at : null;
}

/** A dismissal in the future (the clock moved back) does not hide it forever. */
export function shouldRemindBirthday(input: { birthdayMissing: boolean | undefined; dismissedAt: number | null; now: number }): boolean {
  if (input.birthdayMissing !== true) return false;
  if (input.dismissedAt === null || input.dismissedAt > input.now) return true;
  return input.now - input.dismissedAt >= SNOOZE_MS;
}

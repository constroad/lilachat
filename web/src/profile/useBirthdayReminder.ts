import { useCallback, useEffect, useState } from 'react';
import { birthdayReminderKey, readReminderDismissal, shouldRemindBirthday, type MyProfile } from '@lilachat/shared';
import { getProfile } from './profileApi';

/** The answer of this session: the list mounts again on every space switch, and asking once is enough. */
let known: { userId: string; profile: MyProfile } | null = null;

/** Tests start from a fresh page. */
export const forgetBirthdayReminderCache = (): void => {
  known = null;
};

function readDismissedAt(userId: string): number | null {
  try {
    return readReminderDismissal(localStorage.getItem(birthdayReminderKey(userId)));
  } catch {
    return null;
  }
}

function saveDismissedAt(userId: string, at: number): void {
  try {
    localStorage.setItem(birthdayReminderKey(userId), String(at));
  } catch {
    // A private window: the reminder comes back next time, nothing else depends on it.
  }
}

/**
 * Whether to remind this person to add their birthday (José, 14/11;
 * `shared/birthdayReminder.ts`). A snoozed reminder does not even ask the
 * server; otherwise it asks `/me/profile` once per session.
 */
export function useBirthdayReminder(jwt: string, userId: string): { profile: MyProfile | null; dismiss: () => void; done: (profile: MyProfile) => void } {
  const [dismissedAt, setDismissedAt] = useState(() => readDismissedAt(userId));
  const [profile, setProfile] = useState<MyProfile | null>(() => (known?.userId === userId ? known.profile : null));
  const snoozed = !shouldRemindBirthday({ birthdayMissing: true, dismissedAt, now: Date.now() });
  useEffect(() => {
    if (snoozed || profile || !jwt) return;
    let alive = true;
    void getProfile(jwt).then((answer) => {
      if (!alive || !answer.ok || !answer.data?.profile) return;
      known = { userId, profile: answer.data.profile };
      setProfile(answer.data.profile);
    });
    return () => {
      alive = false;
    };
  }, [jwt, userId, snoozed, profile]);
  const dismiss = useCallback(() => {
    const now = Date.now();
    saveDismissedAt(userId, now);
    setDismissedAt(now);
  }, [userId]);
  const done = useCallback((next: MyProfile) => {
    known = { userId, profile: next };
    setProfile(next);
  }, [userId]);
  const remind = shouldRemindBirthday({ birthdayMissing: profile?.birthdayMissing, dismissedAt, now: Date.now() });
  return { profile: remind ? profile : null, dismiss, done };
}

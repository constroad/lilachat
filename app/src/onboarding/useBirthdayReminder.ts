import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { birthdayReminderKey, readReminderDismissal, shouldRemindBirthday, type MyProfile } from '@lilachat/shared';
import { getProfile } from '../api/profileApi';

/** Not read yet from the device: nothing shows, nothing is asked. */
const READING = 'reading';

/**
 * Whether to remind this person to add their birthday (José, 14/11;
 * `shared/birthdayReminder.ts`). The dismissal lives on this phone; a snoozed
 * reminder does not even ask the server, otherwise it asks `/me/profile` once.
 */
export function useBirthdayReminder(jwt: string, userId: string): { profile: MyProfile | null; dismiss: () => void; done: (profile: MyProfile) => void } {
  const [dismissedAt, setDismissedAt] = useState<number | null | typeof READING>(READING);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(birthdayReminderKey(userId))
      .then((stored) => alive && setDismissedAt(readReminderDismissal(stored)))
      .catch(() => alive && setDismissedAt(null));
    return () => {
      alive = false;
    };
  }, [userId]);
  const snoozed = dismissedAt === READING || !shouldRemindBirthday({ birthdayMissing: true, dismissedAt, now: Date.now() });
  useEffect(() => {
    if (snoozed || profile || !jwt) return;
    let alive = true;
    void getProfile(jwt).then((answer) => {
      if (alive && answer.ok && answer.data?.profile) setProfile(answer.data.profile);
    });
    return () => {
      alive = false;
    };
  }, [jwt, snoozed, profile]);
  const dismiss = useCallback(() => {
    const now = Date.now();
    setDismissedAt(now);
    void AsyncStorage.setItem(birthdayReminderKey(userId), String(now)).catch((error: unknown) => console.warn('[cumpleanos] no se pudo recordar el «Ahora no»:', error instanceof Error ? error.message : error));
  }, [userId]);
  const remind = dismissedAt !== READING && shouldRemindBirthday({ birthdayMissing: profile?.birthdayMissing, dismissedAt, now: Date.now() });
  return { profile: remind ? profile : null, dismiss, done: setProfile };
}

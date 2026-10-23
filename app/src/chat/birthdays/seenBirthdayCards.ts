import AsyncStorage from '@react-native-async-storage/async-storage';

/** The birthday cards already shown on this phone (pending 17): each one once. */
const KEY = 'lilachat.birthdayCards.seen';
/** A day has few: the last ones are enough to never show one twice. */
const KEEP = 60;

let seen: string[] | null = null;

export async function loadSeenBirthdayCards(): Promise<ReadonlySet<string>> {
  if (!seen) seen = JSON.parse((await AsyncStorage.getItem(KEY).catch(() => null)) ?? '[]') as string[];
  return new Set(seen);
}

export async function markBirthdayCardSeen(id: string): Promise<void> {
  const current = seen ?? [];
  seen = [...current.filter((one) => one !== id), id].slice(-KEEP);
  await AsyncStorage.setItem(KEY, JSON.stringify(seen)).catch(() => undefined);
}

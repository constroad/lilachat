/** The birthday cards already shown in this browser (pending 17): each one once, like the app. */
const KEY = 'lilachat.birthdayCards.seen';
/** A day has few: the last ones are enough to never show one twice. */
const KEEP = 60;

function readSeen(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((one): one is string => typeof one === 'string') : [];
  } catch {
    // Private window or blocked storage: the card shows again, nothing breaks.
    return [];
  }
}

export function seenBirthdayCards(): ReadonlySet<string> {
  return new Set(readSeen());
}

export function markBirthdayCardSeen(id: string): void {
  const next = [...readSeen().filter((one) => one !== id), id].slice(-KEEP);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Without storage it is only remembered while the page is open.
  }
}

/**
 * Disappearing messages, like WhatsApp (R31/10-B6): a chat chooses 24 hours,
 * 7 days or 90 days and every NEW message carries its `disappearsAt`. Each
 * device hides what passed it without the network, and the server's sweep
 * removes the content from the base. What was sent before the switch stays.
 */
export type DisappearKey = 'off' | '24h' | '7d' | '90d';

const DAY_SECONDS = 86_400;
const SECONDS: Record<Exclude<DisappearKey, 'off'>, number> = { '24h': DAY_SECONDS, '7d': 7 * DAY_SECONDS, '90d': 90 * DAY_SECONDS };

export const DISAPPEAR_OPTIONS: readonly { key: DisappearKey; label: string }[] = [
  { key: '24h', label: '24 horas' },
  { key: '7d', label: '7 días' },
  { key: '90d', label: '90 días' },
  { key: 'off', label: 'Desactivados' },
];

export const isDisappearKey = (value: unknown): value is DisappearKey => DISAPPEAR_OPTIONS.some((option) => option.key === value);

/** The seconds a key keeps a message; 0 = off. */
export const disappearSecondsOf = (key: DisappearKey): number => (key === 'off' ? 0 : SECONDS[key]);

/** The key of a chat's stored seconds; anything unknown reads as off. */
export function disappearKeyOf(seconds: number | null | undefined): DisappearKey {
  const found = (Object.keys(SECONDS) as Exclude<DisappearKey, 'off'>[]).find((key) => SECONDS[key] === seconds);
  return found ?? 'off';
}

/** «7 días»; «Desactivados» when off. */
export const disappearLabel = (seconds: number | null | undefined): string => DISAPPEAR_OPTIONS.find((option) => option.key === disappearKeyOf(seconds))!.label;

/** When a message sent at `at` disappears in a chat with these seconds; null when it stays. */
export function disappearsAtFor(seconds: number | null | undefined, at: Date): Date | null {
  return disappearKeyOf(seconds) === 'off' ? null : new Date(at.getTime() + (seconds as number) * 1000);
}

/** Whether a message is already gone for this device. */
export function hasDisappeared(message: { disappearsAt?: string | Date | null }, now: number = Date.now()): boolean {
  if (!message.disappearsAt) return false;
  const at = new Date(message.disappearsAt).getTime();
  return !Number.isNaN(at) && at <= now;
}

/** The messages still visible: the ones whose time passed are dropped. */
export function withoutDisappeared<T extends { disappearsAt?: string | Date | null }>(messages: readonly T[], now: number = Date.now()): T[] {
  return messages.some((message) => hasDisappeared(message, now)) ? messages.filter((message) => !hasDisappeared(message, now)) : (messages as T[]);
}

/** Milliseconds until the next visible message disappears; null when none will. */
export function nextDisappearIn(messages: readonly { disappearsAt?: string | Date | null }[], now: number = Date.now()): number | null {
  let soonest: number | null = null;
  for (const message of messages) {
    if (!message.disappearsAt) continue;
    const at = new Date(message.disappearsAt).getTime();
    if (Number.isNaN(at) || at <= now) continue;
    soonest = soonest === null ? at : Math.min(soonest, at);
  }
  return soonest === null ? null : soonest - now;
}

/** The chat notice of a key: «Ana activó…» / «Activaste…»; empty for an unknown key. */
export function disappearNoticeText(actor: string, key: string | undefined, mine = false): string {
  if (!isDisappearKey(key)) return '';
  if (key === 'off') return mine ? 'Desactivaste los mensajes temporales.' : `${actor} desactivó los mensajes temporales.`;
  const after = `Los mensajes nuevos desaparecerán después de ${disappearLabel(disappearSecondsOf(key))}.`;
  return mine ? `Activaste los mensajes temporales. ${after}` : `${actor} activó los mensajes temporales. ${after}`;
}

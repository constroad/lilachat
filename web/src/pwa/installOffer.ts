import { isStandalone, needsIosInstall } from './iosInstall';

/**
 * The strip that offers the app inside the chat lists (José 05/11, from Portal's banner): an
 * iPhone installs the web, an Android phone gets the APK, and a computer keeps its row in Ajustes.
 */
type Device = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>;

export type InstallOffer = 'iphone' | 'android';
export type OfferDismissal = { dismissals: number; snoozeUntil: number | null };

const DISMISSAL_KEY = 'lilachat.install-offer';
const DAY_MS = 24 * 60 * 60 * 1000;
export const OFFER_SNOOZE_MS = 14 * DAY_MS;
/** The first offer plus one return: after that only Ajustes offers it. */
const MAX_DISMISSALS = 2;
const FRESH: OfferDismissal = { dismissals: 0, snoozeUntil: null };

export const isAndroid = (device: Device = navigator): boolean => /Android/.test(device.userAgent);

/** `hasAndroidApp` null: the server has not answered, and a nag is worse than a missed offer. */
export function installOfferFor(device: Device, hasAndroidApp: boolean | null): InstallOffer | null {
  if (needsIosInstall(device)) return 'iphone';
  const browsing = !isStandalone(device as { standalone?: boolean });
  return browsing && isAndroid(device) && hasAndroidApp === false ? 'android' : null;
}

export function readDismissal(): OfferDismissal {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(DISMISSAL_KEY) ?? 'null');
    const { dismissals, snoozeUntil } = (saved ?? {}) as Partial<OfferDismissal>;
    return typeof dismissals === 'number' ? { dismissals, snoozeUntil: typeof snoozeUntil === 'number' ? snoozeUntil : null } : FRESH;
  } catch {
    return FRESH;
  }
}

export function saveDismissal(dismissal: OfferDismissal): void {
  try {
    localStorage.setItem(DISMISSAL_KEY, JSON.stringify(dismissal));
  } catch {
    // A private window: the strip comes back next time, nothing else depends on it.
  }
}

export function nextDismissal(previous: OfferDismissal, now: number): OfferDismissal {
  const dismissals = previous.dismissals + 1;
  return { dismissals, snoozeUntil: dismissals >= MAX_DISMISSALS ? null : now + OFFER_SNOOZE_MS };
}

export const canOffer = (dismissal: OfferDismissal, now: number): boolean =>
  dismissal.dismissals < MAX_DISMISSALS && (dismissal.snoozeUntil === null || now >= dismissal.snoozeUntil);

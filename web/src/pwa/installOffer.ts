import { isStandalone, needsIosInstall } from './iosInstall';

/**
 * The strip that offers the app inside the chat lists (José 05/11, from Portal's banner): an
 * iPhone installs the web; an Android phone installs the web too when the browser offers it
 * (José 06/11: «aún no me propone instalar la PWA»), or gets the APK; a computer keeps its row in Ajustes.
 */
type Device = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>;

export type InstallOffer = 'iphone' | 'pwa' | 'android';
export type OfferDismissal = { dismissals: number; snoozeUntil: number | null };

const DISMISSAL_KEY = 'lilachat.install-offer';
const DAY_MS = 24 * 60 * 60 * 1000;
export const OFFER_SNOOZE_MS = 14 * DAY_MS;
/** The first offer plus one return: after that only Ajustes offers it. */
const MAX_DISMISSALS = 2;
const FRESH: OfferDismissal = { dismissals: 0, snoozeUntil: null };

export const isAndroid = (device: Device = navigator): boolean => /Android/.test(device.userAgent);

/** `canInstall`: the browser's own prompt is at hand. `hasAndroidApp` null: the server has not answered, and a nag is worse than a missed offer. */
export function installOfferFor(device: Device, hasAndroidApp: boolean | null, canInstall = false): InstallOffer | null {
  if (needsIosInstall(device)) return 'iphone';
  if (isStandalone(device as { standalone?: boolean }) || !isAndroid(device)) return null;
  if (canInstall) return 'pwa';
  return hasAndroidApp === false ? 'android' : null;
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

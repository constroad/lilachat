import type { PushState } from '../push';

/** «Ahora no» keeps the banner away this long (like the app's install banner). */
export const OFFER_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
export const OFFER_KEY = 'lilachat.avisoNotificaciones';

/**
 * Whether to offer turning notifications on (design `n-02-web-lista-plegada`):
 * only while permission was never asked (Chrome makes a «no» final, so it is
 * asked when the person taps «Activar», never on load) and not snoozed.
 */
export function shouldOfferNotifications(state: PushState, snoozedAt: number | null, now: number): boolean {
  if (state !== 'apagado') return false;
  return snoozedAt === null || !Number.isFinite(snoozedAt) || now - snoozedAt >= OFFER_SNOOZE_MS;
}

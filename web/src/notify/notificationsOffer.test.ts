import { describe, expect, it } from 'vitest';
import { OFFER_SNOOZE_MS, shouldOfferNotifications } from './notificationsOffer';

describe('shouldOfferNotifications', () => {
  const now = 1_000_000_000_000;
  it('offers while permission was never asked and nobody said «Ahora no»', () => {
    expect(shouldOfferNotifications('apagado', null, now)).toBe(true);
  });
  it('not when it is on, blocked or unsupported', () => {
    expect(shouldOfferNotifications('encendido', null, now)).toBe(false);
    expect(shouldOfferNotifications('bloqueado', null, now)).toBe(false);
    expect(shouldOfferNotifications('sin-soporte', null, now)).toBe(false);
  });
  it('«Ahora no» keeps it away for 14 days', () => {
    expect(shouldOfferNotifications('apagado', now - 1000, now)).toBe(false);
    expect(shouldOfferNotifications('apagado', now - OFFER_SNOOZE_MS, now)).toBe(true);
  });
});

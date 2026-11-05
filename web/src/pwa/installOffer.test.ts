import { afterEach, describe, expect, it, vi } from 'vitest';
import { canOffer, installOfferFor, nextDismissal, OFFER_SNOOZE_MS, readDismissal, saveDismissal } from './installOffer';

const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 };
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 6) Chrome/130.0 Mobile Safari/537.36', platform: 'Linux armv8l', maxTouchPoints: 5 };
const MAC = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 0 };
const NOW = 1_800_000_000_000;

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('installOfferFor', () => {
  it('offers the installed web on an iPhone, with or without the server', () => {
    expect(installOfferFor(IPHONE, null)).toBe('iphone');
  });

  it('offers nothing once the iPhone runs it from the home screen', () => {
    expect(installOfferFor({ ...IPHONE, standalone: true } as typeof IPHONE, null)).toBeNull();
  });

  it('offers the APK to an Android account that does not have it', () => {
    expect(installOfferFor(ANDROID, false)).toBe('android');
  });

  it('does not offer the APK to whoever already has it', () => {
    expect(installOfferFor(ANDROID, true)).toBeNull();
  });

  it('stays quiet on Android until the server answers: a nag is worse than a missed offer', () => {
    expect(installOfferFor(ANDROID, null)).toBeNull();
  });

  it('offers nothing on a computer: it keeps the row in Ajustes', () => {
    expect(installOfferFor(MAC, false)).toBeNull();
  });
});

describe('dismissal', () => {
  it('offers on a fresh browser', () => {
    expect(canOffer(readDismissal(), NOW)).toBe(true);
  });

  it('sleeps 14 days after the first dismissal and comes back once', () => {
    const first = nextDismissal(readDismissal(), NOW);
    expect(canOffer(first, NOW + OFFER_SNOOZE_MS - 1)).toBe(false);
    expect(canOffer(first, NOW + OFFER_SNOOZE_MS)).toBe(true);
  });

  it('never offers by itself after the second dismissal', () => {
    const second = nextDismissal(nextDismissal(readDismissal(), NOW), NOW + OFFER_SNOOZE_MS);
    expect(canOffer(second, NOW + 10 * OFFER_SNOOZE_MS)).toBe(false);
  });

  it('survives a reload', () => {
    saveDismissal(nextDismissal(readDismissal(), NOW));
    expect(readDismissal().dismissals).toBe(1);
  });

  it('treats a corrupt value as fresh', () => {
    localStorage.setItem('lilachat.install-offer', '{not json');
    expect(readDismissal()).toEqual({ dismissals: 0, snoozeUntil: null });
  });

  it('keeps working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readDismissal()).toEqual({ dismissals: 0, snoozeUntil: null });
    vi.restoreAllMocks();
  });
});

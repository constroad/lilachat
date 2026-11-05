import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIos, isStandalone, iphoneGuideSkipped, needsIosInstall, skipIphoneGuide } from './iosInstall';

/** José 05/11: engineers with an iPhone start tomorrow on the installed web. */
const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 };
const IPAD = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 };
const MAC = { ...IPAD, maxTouchPoints: 0 };
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 6) Chrome/130.0 Mobile Safari/537.36', platform: 'Linux armv8l', maxTouchPoints: 5 };

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const inDisplayMode = (standalone: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({ matches: standalone && query.includes('standalone') }));

describe('isIos', () => {
  it('an iPhone, and an iPad that says it is a Mac; a Mac or an Android are not', () => {
    expect(isIos(IPHONE)).toBe(true);
    expect(isIos(IPAD)).toBe(true);
    expect(isIos(MAC)).toBe(false);
    expect(isIos(ANDROID)).toBe(false);
  });
});

describe('isStandalone', () => {
  it('reads the display mode, or Safari\'s own flag', () => {
    inDisplayMode(true);
    expect(isStandalone({})).toBe(true);
    inDisplayMode(false);
    expect(isStandalone({})).toBe(false);
    expect(isStandalone({ standalone: true })).toBe(true);
  });
});

describe('needsIosInstall', () => {
  it('only an iPhone outside the installed app', () => {
    inDisplayMode(false);
    expect(needsIosInstall(IPHONE)).toBe(true);
    expect(needsIosInstall(ANDROID)).toBe(false);
    inDisplayMode(true);
    expect(needsIosInstall(IPHONE)).toBe(false);
  });
});

describe('the guide, once skipped', () => {
  it('stays skipped in this browser', () => {
    expect(iphoneGuideSkipped()).toBe(false);
    skipIphoneGuide();
    expect(iphoneGuideSkipped()).toBe(true);
  });

  it('a private window that refuses the storage still lets the person through', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => skipIphoneGuide()).not.toThrow();
    vi.restoreAllMocks();
  });
});

/**
 * iPhone has no install prompt (spec PLANES-FLUIDEZ §3.2): the person adds the
 * site from Share, and Safari's session does not reach the installed app, so
 * the guide goes BEFORE signing in (José 05/11).
 */
type Device = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>;

const GUIDE_SKIPPED_KEY = 'lilachat.iphone-guide-skipped';
const STANDALONE = '(display-mode: standalone)';

/** iPadOS says it is a Mac: only its touch points give it away. */
export const isIos = (device: Device): boolean => /iPhone|iPad|iPod/.test(device.userAgent) || (device.platform === 'MacIntel' && device.maxTouchPoints > 1);

export const isStandalone = (safari: { standalone?: boolean } = navigator as { standalone?: boolean }): boolean => safari.standalone === true || window.matchMedia?.(STANDALONE).matches === true;

export const needsIosInstall = (device: Device = navigator): boolean => isIos(device) && !isStandalone(device as { standalone?: boolean });

export function iphoneGuideSkipped(): boolean {
  try {
    return localStorage.getItem(GUIDE_SKIPPED_KEY) === '1';
  } catch {
    return false;
  }
}

export function skipIphoneGuide(): void {
  try {
    localStorage.setItem(GUIDE_SKIPPED_KEY, '1');
  } catch {
    // A private window: the guide shows again next time, nothing else depends on it.
  }
}

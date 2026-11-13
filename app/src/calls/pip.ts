import type { CallState } from '@lilachat/shared';

/** A phone is at least ~320 dp on its short side; Android's PiP window is about half that. */
const PIP_SHORT_SIDE_MAX = 260;

/** Leaving the app goes to the small window only in an answered video call (as WhatsApp). PURE. */
export function wantsPip(state: CallState | null, video: boolean): boolean {
  return video && state?.fase === 'activa';
}

/** Whether the window is Android's small PiP one (a zero size is a window not measured yet). PURE. */
export function isPipWindow(width: number, height: number): boolean {
  const shortSide = Math.min(width, height);
  return shortSide > 0 && shortSide < PIP_SHORT_SIDE_MAX;
}

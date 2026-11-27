/**
 * Voice notes like WhatsApp, the same on the app and the web (FL9b; backlog
 * 34): the speed, dragging along the bar, and the first tap that plays.
 * The speed goes 1× · 1,5× · 2× · 3× (José 27/11 asked for 3×).
 */
const PLAYBACK_RATES = [1, 1.5, 2, 3] as const;
/** The phone's player (expo-audio) clamps the speed to 2×: there a 3× chip would lie, so the app stops at 2×. */
export const NATIVE_MAX_PLAYBACK_RATE = 2;

export function nextPlaybackRate(current: number, maxRate = Number.POSITIVE_INFINITY): number {
  const rates = PLAYBACK_RATES.filter((rate) => rate <= maxRate);
  const index = rates.indexOf(current as (typeof PLAYBACK_RATES)[number]);
  return index < 0 ? 1 : (rates[(index + 1) % rates.length] ?? 1);
}

/** Tapping or dragging along the bar: which share of the audio that point is, kept inside it. */
export function scrubFraction(x: number, width: number): number {
  if (!(width > 0) || !Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x / width));
}

/**
 * The first tap only creates the player, and Android ignores a `play()` sent
 * before the audio is loaded: that was the «second tap». It plays once it is
 * loaded, from where the bar was touched, and only once.
 */
export function firstPlay(params: { loaded: boolean; started: boolean; startShare: number | null; duration: number }): { play: false } | { play: true; seekTo: number } {
  if (!params.loaded || params.started) return { play: false };
  return { play: true, seekTo: (params.startShare ?? 0) * Math.max(0, params.duration) };
}

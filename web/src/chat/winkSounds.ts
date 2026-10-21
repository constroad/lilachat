import { NUDGE_SHAKE, SCREEN_EFFECTS, winkCues, type ScreenEffect, type Wink, type WinkSound } from '@lilachat/shared';

const WINK_VOLUME = 0.7;
const playing = new Set<HTMLAudioElement>();

/** A wink's sound: the same files as the app (`public/sonidos`). Blocked autoplay just stays quiet. */
export function playWinkSound(sound: WinkSound): void {
  const audio = new Audio(`${import.meta.env.BASE_URL}sonidos/wink-${sound}.mp3`);
  audio.volume = WINK_VOLUME;
  playing.add(audio);
  audio.onended = () => playing.delete(audio);
  void audio.play().catch(() => playing.delete(audio));
}

/** The music of a wink stops with it. */
export function stopWinkSounds(): void {
  playing.forEach((audio) => audio.pause());
  playing.clear();
}

/**
 * The whole window moves: the nudge's long sideways shake (José, 21/10: like
 * MSN, not a scroll glitch) or a sketch's short effect (a knock jolts it, a hug
 * squeezes it). The same paths as the app.
 */
export function shakeWholeScreen(effect: ScreenEffect | 'nudge' = 'nudge'): void {
  const root = document.getElementById('root');
  if (typeof root?.animate !== 'function') return;
  const shake = effect === 'nudge' ? { ...NUDGE_SHAKE, property: 'x' as const } : SCREEN_EFFECTS[effect];
  const frame = (step: number) => (shake.property === 'x' ? `translateX(${step * shake.amplitude}px)` : `scaleX(${1 - step * shake.amplitude})`);
  root.animate([{ transform: frame(0) }, ...shake.path.map((step) => ({ transform: frame(step) }))], { duration: (shake.path.length + 1) * shake.stepMs, easing: 'linear' });
}

/** Plays a wink's sounds and screen effects at their moments; the returned function cancels what has not happened yet. */
export function playWinkCues(wink: Wink, how: { sound: boolean; animate: boolean }): () => void {
  const timers = winkCues(wink).map((cue) =>
    setTimeout(() => {
      if (cue.sound && how.sound) playWinkSound(cue.sound);
      if (cue.screen && how.animate) shakeWholeScreen(cue.screen);
    }, cue.atMs)
  );
  return () => timers.forEach(clearTimeout);
}

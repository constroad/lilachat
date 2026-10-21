import { useSyncExternalStore, type ReactNode } from 'react';
import Animated, { ReduceMotion, makeMutable, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { NUDGE_SHAKE, SCREEN_EFFECTS, winkCues, type ScreenEffect, type Wink } from '@lilachat/shared';
import { WinkOverlay } from './WinkOverlay';
import { playWinkSound, stopWinkSounds } from './winkSounds';

/**
 * The whole screen, for nudges and winks (José, 21/10: a nudge moves the whole
 * screen, and a wink fills the whole screen when it is sent). It
 * wraps the app once, at the root: a nudge shakes everything (header, chat and
 * bar) sideways like MSN, a sketch jolts or squeezes it (a knock, a hug), and a
 * wink plays over everything without taking touches. Module state: one screen.
 */
const shakeX = makeMutable(0);
const squeezeX = makeMutable(1);

export function shakeScreen(effect: ScreenEffect | 'nudge' = 'nudge'): void {
  const shake = effect === 'nudge' ? { ...NUDGE_SHAKE, property: 'x' as const } : SCREEN_EFFECTS[effect];
  // Never cut short by the phone's «remove animations»: the shake IS the nudge (`shouldPlayFun`).
  const steps = [...shake.path, 0].map((step) => withTiming(shake.property === 'x' ? step * shake.amplitude : 1 - step * shake.amplitude, { duration: shake.stepMs, reduceMotion: ReduceMotion.Never }));
  if (shake.property === 'x') shakeX.value = withSequence(ReduceMotion.Never, ...steps);
  else squeezeX.value = withSequence(ReduceMotion.Never, ...steps);
}

type Playing = { seq: number; wink: Wink } | null;
let playing: Playing = null;
let pendingCues: ReturnType<typeof setTimeout>[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * A wink's sounds and screen effects at their moments (a sketch's knock, the
 * balloon's splash). A new wink replaces the one playing: what had not sounded
 * yet is cancelled and its music stops.
 */
export function playWinkCues(wink: Wink, how: { sound: boolean; animate: boolean }): void {
  pendingCues.forEach(clearTimeout);
  stopWinkSounds();
  pendingCues = winkCues(wink).map((cue) =>
    setTimeout(() => {
      if (cue.sound && how.sound) playWinkSound(cue.sound);
      if (cue.screen && how.animate) shakeScreen(cue.screen);
    }, cue.atMs)
  );
}

export function startWink(next: { seq: number; wink: Wink }): void {
  playing = next;
  notify();
}

function stopWink(): void {
  playing = null;
  stopWinkSounds();
  notify();
}

export function FunScreen({ children }: { children: ReactNode }) {
  const current = useSyncExternalStore(subscribe, () => playing, () => playing);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }, { scaleX: squeezeX.value }] }));
  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      {children}
      <WinkOverlay play={current} onDone={stopWink} />
    </Animated.View>
  );
}

import { useSyncExternalStore, type ReactNode } from 'react';
import Animated, { makeMutable, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { NUDGE_SHAKE, type Wink } from '@lilachat/shared';
import { WinkOverlay } from './WinkOverlay';

/**
 * The whole screen, for nudges and winks (José, 21/10: a nudge moves the whole
 * screen, and a wink fills the whole screen when it is sent). It
 * wraps the app once, at the root: a nudge shakes everything (header, chat and
 * bar) sideways like MSN, and a wink plays over everything without taking
 * touches. Module state: one screen.
 */
const shakeX = makeMutable(0);

export function shakeScreen(): void {
  shakeX.value = withSequence(...NUDGE_SHAKE.path.map((x) => withTiming(x * NUDGE_SHAKE.amplitude, { duration: NUDGE_SHAKE.stepMs })));
}

type Playing = { seq: number; wink: Wink } | null;
let playing: Playing = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function startWink(next: { seq: number; wink: Wink }): void {
  playing = next;
  notify();
}

function stopWink(): void {
  playing = null;
  notify();
}

export function FunScreen({ children }: { children: ReactNode }) {
  const current = useSyncExternalStore(subscribe, () => playing, () => playing);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      {children}
      <WinkOverlay play={current} onDone={stopWink} />
    </Animated.View>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { nextDisappearIn, withoutDisappeared } from '@lilachat/shared';

/** A `setTimeout` tops out near 24.8 days: a longer wait just checks again. */
const MAX_WAIT_MS = 6 * 60 * 60 * 1000;
/** A little after the end, so the clock has passed it when the screen redraws. */
const AFTER_END_MS = 50;

/**
 * The messages still visible by the clock (R31/10-B6). It wakes once, when the
 * next one disappears, and never polls: a chat without the timer sets no timer.
 */
export function useWithoutDisappeared<T extends { disappearsAt?: string | null }>(messages: readonly T[] | null): T[] | null {
  const [tick, setTick] = useState(0);
  const { visible, wait } = useMemo(() => {
    if (!messages) return { visible: null, wait: null };
    const now = Date.now();
    return { visible: withoutDisappeared(messages, now), wait: nextDisappearIn(messages, now) };
    // `tick` re-reads the clock when the next message is due.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, tick]);
  useEffect(() => {
    if (wait === null) return undefined;
    const timer = setTimeout(() => setTick((value) => value + 1), Math.min(wait + AFTER_END_MS, MAX_WAIT_MS));
    return () => clearTimeout(timer);
  }, [wait, tick]);
  return visible;
}

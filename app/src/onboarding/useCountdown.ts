import { useCallback, useEffect, useState } from 'react';

/** Seconds left until a new code may be asked for, and how to start over. */
export function useCountdown(seconds: number): { secondsLeft: number; restart: () => void } {
  const [secondsLeft, setSecondsLeft] = useState(seconds);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);
  const restart = useCallback(() => setSecondsLeft(seconds), [seconds]);
  return { secondsLeft, restart };
}

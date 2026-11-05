import { useEffect, useRef } from 'react';
import { answeredSince, type EphemeralAnswer } from '@lilachat/shared';

/** Runs `onAnswered` once per app answer that arrived: a space action or a report's form asks its data again. */
export function useAnsweredSince(answers: readonly Pick<EphemeralAnswer, 'commandId' | 'state'>[], onAnswered: () => void): void {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const fresh = answeredSince(answers, seen.current);
    fresh.forEach((id) => seen.current.add(id));
    if (fresh.length) onAnswered();
  }, [answers, onAnswered]);
}

import { useSyncExternalStore } from 'react';

/**
 * The drawn width of a bubble with a thread, by `chatId:seq` (José, 22/10:
 * the «3 respuestas» chip hangs from the bubble and its edge did not match:
 * each sized by its own content). The bubble tells it when laid out; its
 * chip reads it.
 */
const widths = new Map<string, number>();
const listeners = new Set<() => void>();

export function rememberBubbleWidth(key: string, width: number): void {
  const rounded = Math.round(width);
  if (widths.get(key) === rounded) return;
  widths.set(key, rounded);
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useBubbleWidth = (key: string): number | undefined => useSyncExternalStore(subscribe, () => widths.get(key));

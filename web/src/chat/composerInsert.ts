/**
 * Text for the open chat's field from elsewhere on the screen (pending 17: the
 * birthday card's «Saludar» writes the greeting there, like the app). Only one
 * composer is on screen at a time.
 */
const listeners = new Set<(text: string) => void>();

export function insertIntoComposer(text: string): void {
  listeners.forEach((listener) => listener(text));
}

export function subscribeComposerInserts(listener: (text: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

import { useSyncExternalStore } from 'react';

/**
 * A child mounted with the page runs its effects BEFORE the shell opens the socket, so it finds none
 * and, with nothing else changing, never listens (06/11: a late answer of the ⚡ was lost and it said
 * the app did not answer). This counts each socket that appears or goes, for an effect to depend on.
 */
let turn = 0;
const watchers = new Set<() => void>();

export function announceSocketTurn(): void {
  turn += 1;
  watchers.forEach((watcher) => watcher());
}

const watch = (watcher: () => void) => {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
};

export const useSocketTurn = (): number => useSyncExternalStore(watch, () => turn);

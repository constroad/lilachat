import { useSyncExternalStore } from 'react';

/**
 * Personal groups as a list, like Slack (José, 21/10; design `s-01`), in this
 * browser. Off by default: WhatsApp's bubbles. A company space's chats are
 * always a list (`usesFlatLayout`).
 */
export const GROUPS_AS_LIST_KEY = 'lilachat.gruposComoLista';
const listeners = new Set<() => void>();

export function readGroupsAsList(): boolean {
  try {
    return window.localStorage.getItem(GROUPS_AS_LIST_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveGroupsAsList(on: boolean): void {
  try {
    window.localStorage.setItem(GROUPS_AS_LIST_KEY, String(on));
  } catch (error) {
    console.warn('[gruposComoLista] no se pudo guardar:', error instanceof Error ? error.message : error);
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useGroupsAsList = (): boolean => useSyncExternalStore(subscribe, readGroupsAsList);

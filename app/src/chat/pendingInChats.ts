import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QUEUE_DISMISSED_KEY, pendingCount } from '@lilachat/shared';
import { agendaGet } from '../agenda/agendaApi';

/**
 * Which chats have something waiting for me (José, 22/10: the cards over the
 * writing bar were great, but the list did not say a chat had one). The keys
 * come from `GET /api/agenda/queue/keys`; the cards dismissed on this phone
 * (`QUEUE_DISMISSED_KEY`, shared with the queue) do not count. Acting on a
 * card or dismissing it takes it off at once.
 */
type State = { keys: Record<string, string[]>; dismissed: ReadonlySet<string> };
let state: State = { keys: {}, dismissed: new Set() };
const listeners = new Set<() => void>();
const emit = (next: State) => {
  state = next;
  for (const listener of [...listeners]) listener();
};

let loading = false;
let askAgain = false;
/** Read again; calls in a row while one is in flight end in one more read, not many. */
export async function refreshPendingInChats(jwt: string): Promise<void> {
  if (loading) {
    askAgain = true;
    return;
  }
  loading = true;
  const [response, stored] = await Promise.all([agendaGet<{ pending: Record<string, string[]> }>('/queue/keys', jwt), AsyncStorage.getItem(QUEUE_DISMISSED_KEY).catch(() => null)]);
  loading = false;
  let dismissed: string[] = [];
  try {
    dismissed = stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    dismissed = [];
  }
  emit({ keys: response.ok ? response.data.pending : state.keys, dismissed: new Set(dismissed) });
  if (askAgain) {
    askAgain = false;
    void refreshPendingInChats(jwt);
  }
}

/** A card acted on or dismissed in the chat: off the list's marker now. */
export function forgetPendingKey(key: string): void {
  if (state.dismissed.has(key)) return;
  emit({ ...state, dismissed: new Set([...state.dismissed, key]) });
}

/** What the chat's own queue just read is the truth for that chat. */
export function setPendingOfChat(chatId: string, keys: string[]): void {
  const before = state.keys[chatId] ?? [];
  if (before.length === keys.length && before.every((key, index) => key === keys[index])) return;
  emit({ ...state, keys: { ...state.keys, [chatId]: keys } });
}

export function forgetPendingInChats(): void {
  emit({ keys: {}, dismissed: new Set() });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** How many things wait for me in this chat. */
export function usePendingInChat(chatId: string): number {
  return useSyncExternalStore(subscribe, () => pendingCount(state.keys[chatId], state.dismissed));
}

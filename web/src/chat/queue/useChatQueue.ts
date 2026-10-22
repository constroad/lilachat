import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QUEUE_DISMISSED_KEY, postponeOneDay, suscribirTarjeta, visibleQueue, withDismissed, type QueueItem } from '@lilachat/shared';
import { api, type ApiResult } from '../../api';

export type QueueAction = 'done' | 'postpone' | 'yes' | 'no';

/** Each item's card in the chat: voting on it there, or ticking it, refreshes the queue too. */
const cardOf = (item: QueueItem) =>
  item.kind === 'task' ? { tipo: 'checklist' as const, id: item.checklistId } : item.kind === 'event' ? { tipo: 'evento' as const, id: item.eventId } : item.kind === 'poll' ? { tipo: 'encuesta' as const, id: item.pollId } : { tipo: 'recordatorio' as const, id: item.reminderId };

function readDismissed(): string[] {
  try {
    const stored = localStorage.getItem(QUEUE_DISMISSED_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function saveDismissed(keys: string[]): void {
  try {
    localStorage.setItem(QUEUE_DISMISSED_KEY, JSON.stringify(keys));
  } catch {
    // Without storage the card comes back next time: nothing is lost.
  }
}

/** The request each action makes; `null` when it only opens or dismisses. */
function requestOf(item: QueueItem, action: QueueAction, jwt: string): Promise<ApiResult<unknown>> | null {
  if (item.kind === 'task' && action === 'done') return api(`/agenda/checklists/${item.checklistId}/items/${item.itemId}/toggle`, { jwt, method: 'POST' });
  if (item.kind === 'task' && action === 'postpone') return api(`/agenda/checklists/${item.checklistId}/items/${item.itemId}`, { jwt, method: 'PATCH', body: { dueAt: postponeOneDay(item.at, new Date()) } });
  if (item.kind === 'event') return api(`/agenda/events/${item.eventId}/rsvp`, { jwt, body: { rsvp: action === 'yes' ? 'yes' : 'no' } });
  return null;
}

/**
 * The queue over the writing bar on the web, like the app's (backlog 36;
 * `shared/chatQueue.ts`): read when the chat opens and whenever one of its
 * cards changes; dismissing is remembered in this browser.
 */
export function useChatQueue(jwt: string, chatId: string) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await api<{ items: QueueItem[] }>(`/agenda/queue?chatId=${chatId}`, { jwt });
    if (response.ok) setItems(response.data.items);
  }, [chatId, jwt]);
  useEffect(() => {
    setItems([]);
    void load();
  }, [load]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // Re-subscribed only when the set of cards changes, not on every read.
  const cardsKey = items.map((item) => `${cardOf(item).tipo}:${cardOf(item).id}`).join(',');
  useEffect(() => {
    const stops = itemsRef.current.map(cardOf).map((card) => suscribirTarjeta(card.tipo, card.id, () => void load()));
    return () => stops.forEach((stop) => stop());
  }, [cardsKey, load]);
  const dismiss = useCallback((item: QueueItem) => {
    setDismissed((before) => {
      const next = withDismissed(before, item.key);
      saveDismissed(next);
      return next;
    });
  }, []);
  const act = useCallback(async (item: QueueItem, action: QueueAction): Promise<string | null> => {
    setBusy(true);
    const response = await requestOf(item, action, jwt);
    setBusy(false);
    if (response && !response.ok) return response.message;
    // Done: it goes now, without waiting for the server's answer.
    setItems((before) => before.filter((one) => one.key !== item.key));
    void load();
    return null;
  }, [jwt, load]);
  const visible = useMemo(() => visibleQueue(items, new Set(dismissed)), [items, dismissed]);
  return { visible, busy, act, dismiss };
}

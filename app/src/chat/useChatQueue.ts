import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QUEUE_DISMISSED_KEY, postponeOneDay, suscribirTarjeta, visibleQueue, withDismissed, type QueueItem } from '@lilachat/shared';
import { agendaGet, agendaPatch, agendaPost } from '../agenda/agendaApi';

export type QueueAction = 'done' | 'postpone' | 'yes' | 'no';

/** Each item's card in the chat: voting on it there, or ticking it, refreshes the queue too. */
const cardOf = (item: QueueItem) =>
  item.kind === 'task' ? { tipo: 'checklist' as const, id: item.checklistId } : item.kind === 'event' ? { tipo: 'evento' as const, id: item.eventId } : item.kind === 'poll' ? { tipo: 'encuesta' as const, id: item.pollId } : { tipo: 'recordatorio' as const, id: item.reminderId };

/**
 * The queue over the writing bar (backlog 36; `shared/chatQueue.ts`): read
 * from `GET /api/agenda/queue` when the chat opens and whenever one of its
 * cards changes; dismissing is remembered on this phone.
 */
export function useChatQueue(jwt: string, chatId: string) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await agendaGet<{ items: QueueItem[] }>(`/queue?chatId=${chatId}`, jwt);
    if (response.ok) setItems(response.data.items);
  }, [chatId, jwt]);
  useEffect(() => {
    setItems([]);
    void load();
  }, [load]);
  useEffect(() => {
    AsyncStorage.getItem(QUEUE_DISMISSED_KEY)
      .then((stored) => setDismissed(stored ? (JSON.parse(stored) as string[]) : []))
      .catch(() => setDismissed([]));
  }, []);
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
      void AsyncStorage.setItem(QUEUE_DISMISSED_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);
  const act = useCallback(async (item: QueueItem, action: QueueAction): Promise<string | null> => {
    setBusy(true);
    const response =
      item.kind === 'task' && action === 'done' ? await agendaPost(`/checklists/${item.checklistId}/items/${item.itemId}/toggle`, jwt, {})
      : item.kind === 'task' && action === 'postpone' ? await agendaPatch(`/checklists/${item.checklistId}/items/${item.itemId}`, jwt, { dueAt: postponeOneDay(item.at, new Date()) })
      : item.kind === 'event' ? await agendaPost(`/events/${item.eventId}/rsvp`, jwt, { rsvp: action === 'yes' ? 'yes' : 'no' })
      : null;
    setBusy(false);
    if (response && !response.ok) return response.message ?? 'No se pudo.';
    // Done: it goes now, without waiting for the server's answer.
    setItems((before) => before.filter((one) => one.key !== item.key));
    void load();
    return null;
  }, [jwt, load]);
  const visible = useMemo(() => visibleQueue(items, new Set(dismissed)), [items, dismissed]);
  return { visible, busy, act, dismiss };
}

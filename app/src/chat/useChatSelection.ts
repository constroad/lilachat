import { useCallback, useEffect, useMemo, useState } from 'react';
import { accionesDeSeleccion } from '@lilachat/shared';
import type { ChatSummary } from '../api/client';

/** The last message's time in ms, to sort; a chat without one goes last. */
export function lastMessageMs(at?: string): number {
  if (!at) return 0;
  const ms = Date.parse(at);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Selecting several chats, like WhatsApp: holding a row enters the mode and
 * marks it, then a tap marks or unmarks; emptying the selection leaves the mode
 * (no separate flag). The actions come from `accionesDeSeleccion`, one per
 * batch. Shared by the personal list and a space's list.
 */
export function useChatSelection(chats: ChatSummary[] | null) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((before) => {
      const next = new Set(before);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);

  // A chat that leaves the list (deleted on another phone) cannot stay selected as a ghost in the bar.
  useEffect(() => {
    if (selected.size === 0) return;
    const alive = new Set((chats ?? []).map((chat) => chat.id));
    setSelected((before) => {
      const kept = new Set([...before].filter((id) => alive.has(id)));
      return kept.size === before.size ? before : kept;
    });
  }, [chats, selected.size]);

  const selectedChats = useMemo(() => (chats ?? []).filter((chat) => selected.has(chat.id)), [chats, selected]);
  const actions = useMemo(
    () =>
      accionesDeSeleccion(
        selectedChats.map((chat) => ({
          id: chat.id,
          esGrupo: chat.kind === 'group',
          muted: chat.muted === true,
          pinned: chat.pinned === true,
          unread: chat.unread,
          fechaOrden: lastMessageMs(chat.lastMessage?.at),
          archived: chat.archived === true,
          marcadoNoLeido: chat.markedUnread === true,
        }))
      ),
    [selectedChats]
  );

  return { selected, selecting: selected.size > 0, toggle, clear, selectedChats, actions };
}

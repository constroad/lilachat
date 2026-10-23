import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatSectionRows, type ChatList } from '@lilachat/shared';
import type { ChatSummary } from '../../api/client';

const collapsedKey = (userId: string) => `lilachat.secciones.plegadas.${userId}`;
const isUnread = (chat: ChatSummary) => chat.unread > 0 || chat.markedUnread === true;

/**
 * The chat list in sections (pending 62): only on «Todos», without a search
 * and outside «Archivados», and only when there are sections. Which ones are
 * folded is remembered on the phone, per account.
 */
export function useChatSections(params: { userId: string; chats: readonly ChatSummary[]; lists: readonly ChatList[]; enabled: boolean }) {
  const { userId, chats, lists, enabled } = params;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    void AsyncStorage.getItem(collapsedKey(userId))
      .then((saved) => setCollapsed(new Set(saved ? (JSON.parse(saved) as string[]) : [])))
      .catch(() => undefined);
  }, [userId]);

  const toggle = useCallback((sectionId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      void AsyncStorage.setItem(collapsedKey(userId), JSON.stringify([...next])).catch(() => undefined);
      return next;
    });
  }, [userId]);

  const rows = useMemo(() => chatSectionRows(chats, enabled ? lists : [], collapsed, isUnread), [chats, lists, enabled, collapsed]);
  return { rows, toggle };
}

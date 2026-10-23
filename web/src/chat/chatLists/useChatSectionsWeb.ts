import { useCallback, useMemo, useState } from 'react';
import { chatSectionRows, type ChatList } from '@lilachat/shared';
import type { ChatSummary } from '../types';

const COLLAPSED_KEY = 'lilachat.secciones.plegadas';
const isUnread = (chat: ChatSummary) => chat.unread > 0 || chat.markedUnread === true;

function readCollapsed(userId: string): Set<string> {
  try {
    const saved = localStorage.getItem(`${COLLAPSED_KEY}.${userId}`);
    return new Set(saved ? (JSON.parse(saved) as string[]) : []);
  } catch {
    // Without storage (a private window) every section starts open.
    return new Set();
  }
}

/**
 * The chat list in sections on the web (pending 62): only on «Todos», without
 * a search and outside «Archivados», and only when there are sections. Which
 * ones are folded is remembered in this browser, per account.
 */
export function useChatSectionsWeb(params: { userId: string; chats: readonly ChatSummary[]; lists: readonly ChatList[]; enabled: boolean }) {
  const { userId, chats, lists, enabled } = params;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => readCollapsed(userId));

  const toggle = useCallback((sectionId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      try {
        localStorage.setItem(`${COLLAPSED_KEY}.${userId}`, JSON.stringify([...next]));
      } catch {
        // Not remembered without storage: it still folds for this visit.
      }
      return next;
    });
  }, [userId]);

  const rows = useMemo(() => chatSectionRows(chats, enabled ? lists : [], collapsed, isUnread), [chats, lists, enabled, collapsed]);
  return { rows, toggle };
}

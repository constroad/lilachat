import type { ChatList } from './chatLists.js';

/**
 * The chat list in folding sections, like Slack's sidebar (pending 62, José
 * 23/10; design `r154-secciones`). Each list of my own is a section in its
 * order; a chat goes in the first one that has it, and the rest go in «Sin
 * sección» at the end. A folded section shows how many chats are unread. PURE.
 */
export const NO_SECTION_KEY = 'sin-seccion';
const NO_SECTION_TITLE = 'Sin sección';

export type SectionRow = { type: 'section'; key: string; sectionId: string; listId: string | null; title: string; count: number; unread: number; collapsed: boolean };
export type ChatRow<T> = { type: 'chat'; key: string; chat: T };

export function sectionOfChat(lists: readonly ChatList[], chatId: string): ChatList | null {
  return lists.find((list) => list.chatIds.includes(chatId)) ?? null;
}

/** The rows to draw, in order: a header per section and, when open, its chats. Without sections, only the chats. */
export function chatSectionRows<T extends { id: string }>(chats: readonly T[], lists: readonly ChatList[], collapsed: ReadonlySet<string>, isUnread: (chat: T) => boolean): (SectionRow | ChatRow<T>)[] {
  const toRow = (chat: T): ChatRow<T> => ({ type: 'chat', key: chat.id, chat });
  if (lists.length === 0) return chats.map(toRow);
  const bySection = new Map<string, T[]>([...lists.map((list) => [list.id, []] as [string, T[]]), [NO_SECTION_KEY, []]]);
  for (const chat of chats) bySection.get(sectionOfChat(lists, chat.id)?.id ?? NO_SECTION_KEY)!.push(chat);
  const sections = [...lists.map((list) => ({ sectionId: list.id, listId: list.id as string | null, title: list.name })), { sectionId: NO_SECTION_KEY, listId: null, title: NO_SECTION_TITLE }];
  return sections.flatMap(({ sectionId, listId, title }) => {
    const inside = bySection.get(sectionId) ?? [];
    if (listId === null && inside.length === 0) return [];
    const folded = collapsed.has(sectionId);
    const header: SectionRow = { type: 'section', key: `section:${sectionId}`, sectionId, listId, title, count: inside.length, unread: inside.filter(isUnread).length, collapsed: folded };
    return [header, ...(folded ? [] : inside.map(toRow))];
  });
}

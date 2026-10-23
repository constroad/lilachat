import { describe, expect, it } from 'vitest';
import { chatSectionRows, NO_SECTION_KEY, sectionOfChat } from './chatSections.js';
import type { ChatList } from './chatLists.js';

type Row = { id: string; unread: boolean };
const isUnread = (chat: Row) => chat.unread;
const chats: Row[] = [
  { id: 'a', unread: true },
  { id: 'b', unread: false },
  { id: 'c', unread: true },
  { id: 'd', unread: false },
  { id: 'e', unread: true },
];
const lists: ChatList[] = [
  { id: 'obra', name: 'Obra Huachipa', chatIds: ['c', 'a'] },
  { id: 'familia', name: 'Familia', chatIds: ['e', 'a'] },
  { id: 'vacia', name: 'Vacía', chatIds: [] },
];

describe('chat sections like Slack (pending 62)', () => {
  it('without sections the list stays as it was, without headers', () => {
    expect(chatSectionRows(chats, [], new Set(), isUnread).map((row) => row.key)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('each section in its order with its chats as the chat list sorts them, a chat only in the first one, and the rest «Sin sección» at the end', () => {
    const rows = chatSectionRows(chats, lists, new Set(), isUnread);
    expect(rows.map((row) => (row.type === 'section' ? `[${row.title} ${row.count}]` : row.key))).toEqual(['[Obra Huachipa 2]', 'a', 'c', '[Familia 1]', 'e', '[Vacía 0]', '[Sin sección 2]', 'b', 'd']);
  });

  it('a folded section hides its chats and its header says how many are unread', () => {
    const rows = chatSectionRows(chats, lists, new Set(['obra', NO_SECTION_KEY]), isUnread);
    expect(rows.map((row) => row.key)).toEqual(['section:obra', 'section:familia', 'e', 'section:vacia', `section:${NO_SECTION_KEY}`]);
    expect(rows[0]).toMatchObject({ type: 'section', collapsed: true, unread: 2 });
    expect(rows.at(-1)).toMatchObject({ type: 'section', collapsed: true, unread: 0, count: 2 });
  });

  it('with every chat in a section there is no «Sin sección»', () => {
    const all: ChatList[] = [{ id: 'todo', name: 'Todo', chatIds: ['a', 'b', 'c', 'd', 'e'] }];
    expect(chatSectionRows(chats, all, new Set(), isUnread).filter((row) => row.type === 'section')).toHaveLength(1);
  });

  it('knows the one section a chat is in', () => {
    expect(sectionOfChat(lists, 'a')?.id).toBe('obra');
    expect(sectionOfChat(lists, 'b')).toBeNull();
  });
});

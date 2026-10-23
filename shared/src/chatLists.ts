/**
 * Lists of chats of one's own («Familia», «Amigos»), like Telegram's folders
 * and WhatsApp's lists (pending 45, José 22/10). They live in the person's
 * profile: the phone and the web read the same ones. PURE.
 */
export type ChatList = { id: string; name: string; chatIds: string[] };

export const CHAT_LISTS_MAX = 20;
export const CHAT_LIST_NAME_MAX = 24;
export const CHAT_LIST_CHATS_MAX = 500;

/** The fixed chips and «Sin sección» (pending 62): a list cannot take their names. */
const FIXED_CHIPS = ['todos', 'no leidos', 'grupos', 'borradores', 'sin seccion'];

const key = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

/** What is wrong with a list's name, or null when it is fine. */
export function chatListNameError(name: string, lists: readonly ChatList[], exceptId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Escribe un nombre para la sección.';
  if (trimmed.length > CHAT_LIST_NAME_MAX) return `El nombre puede tener hasta ${CHAT_LIST_NAME_MAX} letras.`;
  if (FIXED_CHIPS.includes(key(trimmed))) return 'Ese nombre ya es un filtro de la lista.';
  if (lists.some((list) => list.id !== exceptId && key(list.name) === key(trimmed))) return 'Ya tienes una sección con ese nombre.';
  return null;
}

/** Chats added at the end, without repeats, and removed; never more than a list holds. */
export function changeListChats(chatIds: readonly string[], change: { add?: readonly string[]; remove?: readonly string[] }): string[] {
  const removed = new Set(change.remove ?? []);
  const next = chatIds.filter((chatId) => !removed.has(chatId));
  for (const chatId of change.add ?? []) {
    if (!removed.has(chatId) && !next.includes(chatId)) next.push(chatId);
  }
  return next.slice(0, CHAT_LIST_CHATS_MAX);
}

const LIST_PREFIX = 'lista:';

/** The chip filter of a list. */
export const listFilter = (listId: string): `lista:${string}` => `${LIST_PREFIX}${listId}`;

/** The list a chip filters by, or null for a fixed chip. */
export function listIdOf(filter: string): string | null {
  return filter.startsWith(LIST_PREFIX) ? filter.slice(LIST_PREFIX.length) : null;
}

export function listsWithChat(lists: readonly ChatList[], chatId: string): ChatList[] {
  return lists.filter((list) => list.chatIds.includes(chatId));
}

/** What the editor changed: the chats to add and to take out. */
export function diffListChats(before: readonly string[], after: readonly string[]): { add: string[]; remove: string[] } {
  return { add: after.filter((chatId) => !before.includes(chatId)), remove: before.filter((chatId) => !after.includes(chatId)) };
}

/** Whether the chats chosen in the list are all in a list, some of them, or none. */
export function listMembership(list: ChatList, chatIds: readonly string[]): 'all' | 'some' | 'none' {
  const inside = chatIds.filter((chatId) => list.chatIds.includes(chatId)).length;
  if (inside === 0) return 'none';
  return inside === chatIds.length ? 'all' : 'some';
}

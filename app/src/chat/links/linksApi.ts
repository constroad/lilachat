import type { LinkCard, LinkCategory, LinkNoteItem } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall, type JsonResult } from '../../api/jsonCall';

/**
 * A notes chat's links by category (José 18/11), the server's
 * `linkSortingRoutes.ts` under `/api/chats`. Never throws: a refusal brings
 * the server's message, no network says so.
 */
export type ChatLinks = { enabled: boolean; categories: LinkCategory[]; items: LinkNoteItem[] };
type Done = { ok: true };

const chatUrl = (chatId: string) => `${BASE_URL}/api/chats/${encodeURIComponent(chatId)}`;
const send = <T>(jwt: string, url: string, method: 'POST' | 'PUT' | 'PATCH', body?: object): Promise<JsonResult<T>> =>
  jsonCall<T>(url, jwt, { method, ...(body ? { body: JSON.stringify(body) } : {}) });

export const fetchChatLinks = (jwt: string, chatId: string) => jsonCall<ChatLinks>(`${chatUrl(chatId)}/links`, jwt);

/** Turning it on sorts the links already in the chat: the cards arrive by socket in a minute or two. */
export const putLinkSorting = (jwt: string, chatId: string, enabled: boolean) => send<Done>(jwt, `${chatUrl(chatId)}/link-sorting`, 'PUT', { enabled });

export const postLinkCategory = (jwt: string, chatId: string, name: string) => send<Done & { category: LinkCategory }>(jwt, `${chatUrl(chatId)}/link-categories`, 'POST', { name });

export const patchLinkCategory = (jwt: string, chatId: string, categoryId: string, name: string) =>
  send<Done>(jwt, `${chatUrl(chatId)}/link-categories/${encodeURIComponent(categoryId)}`, 'PATCH', { name });

/** `into: null` leaves its links «Sin categoría». */
export const mergeLinkCategory = (jwt: string, chatId: string, categoryId: string, into: string | null) =>
  send<Done>(jwt, `${chatUrl(chatId)}/link-categories/${encodeURIComponent(categoryId)}/merge`, 'POST', { into });

/** The person's choice: Lila never changes it again. */
export const putLinkCategoryOf = (jwt: string, chatId: string, seq: number, categoryId: string | null) =>
  send<Done & { link: LinkCard }>(jwt, `${chatUrl(chatId)}/messages/${seq}/link-category`, 'PUT', { categoryId });

/** «Reintentar» on a card the network did not show: 202, the new card arrives by socket. */
export const postLinkRefresh = (jwt: string, chatId: string, seq: number) => send<Done>(jwt, `${chatUrl(chatId)}/messages/${seq}/link-refresh`, 'POST');

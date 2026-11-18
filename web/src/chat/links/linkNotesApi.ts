import type { LinkCard, LinkCategory, LinkNoteItem } from '@lilachat/shared';
import { api, type ApiResult } from '../../api';

/**
 * The «Por categoría» calls of a notes chat (server `linkSortingRoutes.ts`),
 * all under `/api/chats/:chatId`.
 */
export type LinkNotes = { enabled: boolean; categories: LinkCategory[]; items: LinkNoteItem[] };
type Done = { ok: true };

const chatPath = (chatId: string) => `/chats/${encodeURIComponent(chatId)}`;

export function fetchLinkNotes(jwt: string, chatId: string): Promise<ApiResult<LinkNotes>> {
  return api<LinkNotes>(`${chatPath(chatId)}/links`, { jwt });
}

export function saveLinkSorting(jwt: string, chatId: string, enabled: boolean): Promise<ApiResult<Done>> {
  return api<Done>(`${chatPath(chatId)}/link-sorting`, { jwt, method: 'PUT', body: { enabled } });
}

export function createLinkCategory(jwt: string, chatId: string, name: string): Promise<ApiResult<Done & { category: LinkCategory }>> {
  return api<Done & { category: LinkCategory }>(`${chatPath(chatId)}/link-categories`, { jwt, method: 'POST', body: { name } });
}

export function renameLinkCategory(jwt: string, chatId: string, categoryId: string, name: string): Promise<ApiResult<Done>> {
  return api<Done>(`${chatPath(chatId)}/link-categories/${encodeURIComponent(categoryId)}`, { jwt, method: 'PATCH', body: { name } });
}

/** «Unir con…»: `into` null sends its links to «Sin categoría». The category disappears. */
export function mergeLinkCategory(jwt: string, chatId: string, categoryId: string, into: string | null): Promise<ApiResult<Done>> {
  return api<Done>(`${chatPath(chatId)}/link-categories/${encodeURIComponent(categoryId)}/merge`, { jwt, method: 'POST', body: { into } });
}

/** A person's choice: Lila never changes it again. */
export function moveLinkToCategory(jwt: string, chatId: string, seq: number, categoryId: string | null): Promise<ApiResult<Done & { link: LinkCard }>> {
  return api<Done & { link: LinkCard }>(`${chatPath(chatId)}/messages/${seq}/link-category`, { jwt, method: 'PUT', body: { categoryId } });
}

/** «Reintentar» on a link the network did not show: the new card arrives by socket. */
export function refreshLinkCard(jwt: string, chatId: string, seq: number): Promise<ApiResult<Done>> {
  return api<Done>(`${chatPath(chatId)}/messages/${seq}/link-refresh`, { jwt, method: 'POST' });
}

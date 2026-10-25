import { listChats, type ChatSummary } from '../api/client';
import { chatsEnMemoria, leerChatsGuardados } from '../chat/chatsGuardados';
import { spaceChats } from '../spaces/spacesApi';
import type { NoticeLookup } from './noticeOpener';

/**
 * Un chat por su id, para abrirlo desde afuera de la lista (un aviso, un
 * destacado): primero lo que hay en memoria o en el teléfono, y si no, el server.
 */
export async function buscarChat(chatId: string, jwt: string): Promise<ChatSummary | null> {
  const enMano = chatsEnMemoria() ?? (await leerChatsGuardados());
  const conocido = enMano?.find((chat) => chat.id === chatId);
  if (conocido) return conocido;
  const respuesta = await listChats(jwt);
  return respuesta.ok ? (respuesta.data.chats.find((chat) => chat.id === chatId) ?? null) : null;
}

/** The server answered that the chat is not there for this person (not a member, no such space). */
const ANSWERED_NOT_THERE = new Set([403, 404]);

/** The chat in a server answer: found, not in it, or no answer about it (a timeout, a 5xx, a stale jwt). */
function lookupIn(answer: { ok: true; data: { chats: ChatSummary[] } } | { ok: false; status?: number | 'network' }, chatId: string): NoticeLookup {
  if (!answer.ok) return typeof answer.status === 'number' && ANSWERED_NOT_THERE.has(answer.status) ? { kind: 'missing' } : { kind: 'failed' };
  const chat = answer.data.chats.find((candidate) => candidate.id === chatId);
  return chat ? { kind: 'found', chat } : { kind: 'missing' };
}

/**
 * The chat a notice leads to (agentes 25/10/2026). One of a space is not in the
 * personal list: the space is asked for it. The answer tells «not there» from «no
 * answer» (B4 E2E: one failed request used to drop the tap), so the caller knows
 * whether asking again can help.
 */
export async function lookupNoticeChat(destination: { chatId: string; workspaceId?: string }, jwt: string): Promise<NoticeLookup> {
  const inMemory = chatsEnMemoria()?.find((chat) => chat.id === destination.chatId);
  if (inMemory) return { kind: 'found', chat: inMemory };
  // The list saved on the phone may hold a space's chats too: open from it without waiting for the network.
  const saved = (await leerChatsGuardados())?.find((chat) => chat.id === destination.chatId);
  if (saved) return { kind: 'found', chat: saved };
  if (destination.workspaceId) return lookupIn(await spaceChats(jwt, destination.workspaceId), destination.chatId);
  return lookupIn(await listChats(jwt), destination.chatId);
}

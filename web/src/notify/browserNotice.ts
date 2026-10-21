import { armarAviso, type Aviso } from '@lilachat/shared';
import type { BaseLocal } from '../local/baseLocal';
import type { ChatMessage } from '../chat/types';

type NoticeKind = Parameters<typeof armarAviso>[0]['kind'];
const NOTICE_KINDS = new Set<string>(['text', 'image', 'video', 'audio', 'file', 'poll', 'event', 'reminder', 'sticker', 'zumbido', 'guino']);
const ICON = '/icons/icon-192.png';

/**
 * A system notice from the open page (José, 21/10: «notificaciones del
 * sistema en la web»). The server only pushes to devices without a live
 * socket, so an open tab out of sight got nothing. Only with the tab hidden,
 * for someone else's message, outside a muted chat, and once permission was
 * given (the banner asks for it; never on load).
 */
export function shouldShowBrowserNotice(params: { senderId: string; me: string; hidden: boolean; muted: boolean; kind: string; threadOnly: boolean; permission: NotificationPermission }): boolean {
  if (params.senderId === params.me || !params.hidden || params.muted || params.threadOnly) return false;
  return params.kind !== 'system' && params.permission === 'granted';
}

/** The same words as the push (`armarAviso`): the chat as title; nudges and winks said plainly; a secret chat hides the text. */
export function browserNoticeText(chat: { name?: string; phone?: string; kind?: string; encrypted?: boolean }, message: { kind: string; body?: string }): Aviso {
  return armarAviso({
    chatName: chat.name ?? chat.phone ?? 'Lilachat',
    senderName: null,
    esGrupo: chat.kind === 'group',
    kind: (NOTICE_KINDS.has(message.kind) ? message.kind : 'text') as NoticeKind,
    body: message.body ?? '',
    cifrado: chat.encrypted === true,
  });
}

/** Shows it through the service worker (its click opens the chat), or straight from the page without one. Never throws. */
export async function showBrowserNoticeIfHidden(base: BaseLocal | null, message: ChatMessage, me: string): Promise<void> {
  try {
    if (typeof Notification === 'undefined') return;
    const chat = base ? await base.chats.get(message.chatId) : undefined;
    const show = shouldShowBrowserNotice({ senderId: message.senderId, me, hidden: document.visibilityState === 'hidden', muted: Boolean(chat?.muted), kind: message.kind, threadOnly: message.hiloDe !== undefined && !message.enElChat, permission: Notification.permission });
    if (!show) return;
    const { titulo, cuerpo } = browserNoticeText(chat ?? {}, message);
    const options: NotificationOptions = { body: cuerpo, icon: ICON, tag: message.chatId, data: { chatId: message.chatId } };
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification(titulo, options);
    else new Notification(titulo, options);
  } catch (error) {
    console.warn('[aviso] no se pudo mostrar el aviso del sistema:', error);
  }
}

import { useEffect, useRef } from 'react';
import { aplicarMensajeALista, marcarLeido } from '@lilachat/shared';
import type { MensajeEnVivo as LiveMessage } from '@lilachat/shared';
import type { ChatSummary } from '../api/client';
import { chatsEnMemoria } from '../chat/chatsGuardados';
import { openChatNow } from '../chat/openChatNow';
import { getSocket } from '../chat/socketClient';
import { isSpaceChat, rememberMyRead, spaceChatsCache } from './spaceCache';

/** Several messages in a row reload the list once. */
const RELOAD_DELAY_MS = 600;
/** A chat of the personal list: its events are not this space's. */
const isInMyChatList = (chatId: string) => Boolean(chatsEnMemoria()?.some((chat) => chat.id === chatId));

/**
 * Socket events applied in place to a space's cached chats (22/10): a message in one of these chats
 * changes its row, reading one lowers its count; only an unknown chat, a changed one or a possible
 * mention or thread asks the server, once per burst. Before, ANY message, also of personal chats,
 * reloaded the list and the chips. The space list and the Dali inbox share it (same cache key).
 */
export function useSpaceChatsLive(key: string, myUserId: string, load: () => Promise<void>): void {
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const socket = getSocket();
    const reloadSoon = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => void load(), RELOAD_DELAY_MS);
    };
    const inList = (chatId?: string) => Boolean(chatId && spaceChatsCache.get(key).value?.chats.some((chat) => chat.id === chatId));
    const patchChats = (change: (current: ChatSummary[]) => ChatSummary[] | null) =>
      spaceChatsCache.patch(key, (current) => {
        const next = change(current.chats);
        return next && next !== current.chats ? { ...current, chats: next } : current;
      });
    const onMessage = (message: LiveMessage) => {
      if (!inList(message.chatId)) {
        // A new chat of this space (not a personal one, not another space's) is asked for.
        if (!isSpaceChat(message.chatId) && !isInMyChatList(message.chatId)) reloadSoon();
        return;
      }
      patchChats((current) => aplicarMensajeALista(current, message, myUserId, openChatNow()));
      if (message.hiloDe !== undefined || message.body?.includes('@')) reloadSoon();
    };
    const onChanged = (frame: { chatId?: string }) => {
      if (!frame.chatId || inList(frame.chatId) || !isInMyChatList(frame.chatId)) reloadSoon();
    };
    // I read one of these chats (here or on another device): its count goes down.
    const onReceipt = (frame: { chatId?: string; userId?: string; readSeq?: number }) => {
      if (frame.userId !== myUserId || !frame.chatId) return;
      rememberMyRead(frame.chatId, frame.readSeq);
      if (inList(frame.chatId)) patchChats((current) => marcarLeido(current, frame.chatId!));
    };
    socket?.on('msg.new', onMessage);
    socket?.on('chat.changed', onChanged);
    socket?.on('receipt', onReceipt);
    return () => {
      socket?.off('msg.new', onMessage);
      socket?.off('chat.changed', onChanged);
      socket?.off('receipt', onReceipt);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [key, load, myUserId]);
}

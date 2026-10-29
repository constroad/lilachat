import { useCallback, useEffect, useRef, useState } from 'react';
import { callReactionOf, createAckWatch, reactionEvents, reactionKeyOf, reactionMissedNotice, type CallReaction } from '@lilachat/shared';
import { getSocket } from '../../chat/socketClient';

type Played = { reaction: CallReaction; key: number };
const NOTICE_MS = 6000;
const EVENTS = reactionEvents('groupcall');

/**
 * Winks, stickers and effects inside a group call (pending 4), like the web's
 * `useCallReactions(…, 'groupcall')`: relayed only to the room, mine play here
 * too, and one «seen» from anyone is enough (105b).
 */
export function useGroupReactions(chatId: string | null) {
  const [played, setPlayed] = useState<Played | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [watch] = useState(() => createAckWatch(() => setNotice(reactionMissedNotice('groupcall', ''))));
  const chatRef = useRef(chatId);
  chatRef.current = chatId;
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !chatId) return;
    const onReaction = (frame: { chatId?: string; reaction?: unknown; key?: unknown }) => {
      const reaction = frame.chatId === chatId ? callReactionOf(frame.reaction) : null;
      if (!reaction) return;
      setPlayed({ reaction, key: Date.now() });
      const key = reactionKeyOf(frame.key);
      if (key) socket.emit(EVENTS.ack, { chatId, key });
    };
    const onSeen = (frame: { chatId?: string; key?: unknown }) => {
      const key = frame.chatId === chatId ? reactionKeyOf(frame.key) : null;
      if (key) watch.seen(key);
    };
    socket.on(EVENTS.reaction, onReaction);
    socket.on(EVENTS.ack, onSeen);
    return () => {
      socket.off(EVENTS.reaction, onReaction);
      socket.off(EVENTS.ack, onSeen);
      watch.stop();
    };
  }, [chatId, watch]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  const send = useCallback((reaction: CallReaction) => {
    if (!chatRef.current) return;
    const key = `k-${Date.now()}`;
    setNotice(null);
    getSocket()?.emit(EVENTS.reaction, { chatId: chatRef.current, reaction, key });
    watch.sent(key);
    setPlayed({ reaction, key: Date.now() });
  }, [watch]);
  const clear = useCallback(() => setPlayed(null), []);
  return { played, notice, send, clear };
}

import type { Socket } from 'socket.io-client';
import type { AcuseEnVivo } from '@lilachat/shared';
import { clearChatNotices } from './avisoLocal';
import { guardarMensajes } from './mensajesGuardados';
import { chatReadByMe } from './readElsewhere';
import type { ServerMessage } from './socketClient';
import type { ChatMessage } from './useChat';


/**
 * What keeps the phone's notices in step with the chats (José 16/11), for the whole session:
 *  - every message that arrives is kept on the phone, open chat or not, as Telegram does, so
 *    tapping its notice paints it at once instead of waiting for the network;
 *  - a chat I read on the web or another phone takes its notices off this one.
 */
export function listenForNoticeSync(socket: Socket, me: string): () => void {
  const keepArrived = (message: ServerMessage) => void guardarMensajes(message.chatId, [message as ChatMessage]);
  const clearRead = (receipt: AcuseEnVivo) => {
    const read = chatReadByMe(receipt, me);
    if (read) void clearChatNotices(read);
  };
  socket.on('msg.new', keepArrived);
  socket.on('receipt', clearRead);
  return () => {
    socket.off('msg.new', keepArrived);
    socket.off('receipt', clearRead);
  };
}

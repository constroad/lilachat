import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { advanceCursors, mergeBySeq, type Cursors, type OutboxItem } from '@lilachat/shared';
import { connectSocket, getSocket, type ServerMessage } from './socketClient';
import { uploadMedia, type UploadResult } from './mediaUpload';
import { drainOutbox, hydrateOutbox, queueMessage, subscribeOutbox } from './outboxStore';

/**
 * El estado vivo de un chat: mensajes confirmados + lo que está en la cola.
 *
 * Al reconectar NO se recarga todo: se pide el delta por cursor
 * (`sync.pull`) — el modelo de Telegram. Y el mismo mensaje puede llegar por
 * dos caminos (evento en vivo y lote de sync), por eso todo pasa por
 * `mergeBySeq`, que deduplica.
 */
export type ChatMessage = ServerMessage & { pending?: false };
export type PendingMessage = { clientKey: string; body?: string; queuedAt: string; pending: true };

export function useChat(params: { chatId: string; token: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [connected, setConnected] = useState(false);
  /**
   * Acuses del OTRO, en vivo. Antes llegaban como prop desde la lista y no se
   * actualizaban nunca: si el otro leía con el chat abierto, el check jamás
   * cambiaba de color.
   */
  const [othersRead, setOthersRead] = useState(0);
  const cursors = useRef<Cursors>({});

  useEffect(() => {
    let alive = true;
    void hydrateOutbox();

    const unsubscribe = subscribeOutbox((items: OutboxItem[]) => {
      if (!alive) return;
      setPending(
        items
          .filter((item) => item.chatId === params.chatId)
          .map((item) => ({
            clientKey: item.clientKey,
            body: item.body,
            queuedAt: item.queuedAt,
            pending: true as const,
          }))
      );
    });

    const socket = connectSocket(params.token);

    const pull = () => {
      socket.emit('sync.pull', { cursors: cursors.current }, (response: unknown) => {
        const payload = response as { ok?: boolean; batches?: { chatId: string; messages: ServerMessage[] }[] };
        if (!alive || !payload?.ok || !payload.batches) return;
        cursors.current = advanceCursors(cursors.current, payload.batches);
        const mine = payload.batches.find((batch) => batch.chatId === params.chatId);
        if (mine) setMessages((current) => mergeBySeq(current, mine.messages as ChatMessage[]));
        // Reconectado: lo que quedó en la cola sale ahora.
        void drainOutbox();
      });
    };

    const onConnect = () => {
      if (!alive) return;
      setConnected(true);
      pull();
    };
    const onDisconnect = () => alive && setConnected(false);
    const onNew = (message: ServerMessage) => {
      if (!alive || message.chatId !== params.chatId) return;
      cursors.current = advanceCursors(cursors.current, [
        { chatId: message.chatId, messages: [message] },
      ]);
      setMessages((current) => mergeBySeq(current, [message as ChatMessage]));
    };

    const onReceipt = (frame: { chatId: string; userId: string; readSeq: number }) => {
      if (!alive || frame.chatId !== params.chatId) return;
      // Nunca retrocede: dos dispositivos del otro mandan acuses desordenados.
      setOthersRead((current) => Math.max(current, frame.readSeq));
    };

    socket.on('receipt', onReceipt);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('msg.new', onNew);
    if (socket.connected) onConnect();

    return () => {
      alive = false;
      unsubscribe();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('msg.new', onNew);
      socket.off('receipt', onReceipt);
    };
  }, [params.chatId, params.token]);

  /**
   * Enviar = ENCOLAR. Nunca se manda directo: así el camino con red y el camino
   * sin red son el mismo código, y el sin-red no es un caso especial que se
   * pruebe último (y por eso se rompa).
   */
  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text) return;
      await queueMessage({
        clientKey: Crypto.randomUUID(),
        chatId: params.chatId,
        kind: 'text',
        body: text,
        queuedAt: new Date().toISOString(),
        attempts: 0,
      });
    },
    [params.chatId]
  );

  /**
   * Media: sube por HTTP y el mensaje lo crea el server en el MISMO request.
   * El resultado no se inserta a mano en la lista — llega por `msg.new` como
   * cualquier otro mensaje, y `mergeBySeq` evita el duplicado.
   */
  const sendMedia = useCallback(
    async (file: {
      uri: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      caption?: string;
      onProgress?: (ratio: number) => void;
    }): Promise<UploadResult> =>
      uploadMedia({
        token: params.token,
        chatId: params.chatId,
        clientKey: Crypto.randomUUID(),
        ...file,
      }),
    [params.chatId, params.token]
  );

  const markRead = useCallback(
    (seq: number) => {
      getSocket()?.emit('read.set', { chatId: params.chatId, seq });
    },
    [params.chatId]
  );

  return { messages, pending, connected, othersRead, send, sendMedia, markRead };
}

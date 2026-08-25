import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ChatMessage } from './chat/types';

/**
 * El socket de la web, con el MISMO contrato que la app (F2/F4): JWT en el
 * handshake, sala por usuario, `msg.new`, `presence.*` y `receipt`.
 *
 * Un solo socket para toda la sesión, en una ref: si viviera en el estado, cada
 * render abriría uno nuevo y el server vería una avalancha de conexiones del
 * mismo usuario — que además rompe el conteo de presencia.
 */
export type SocketState = {
  connected: boolean;
  online: Set<string>;
  typingByChat: Map<string, string>;
};

export function useSocket(params: {
  jwt: string | null;
  onMessage: (message: ChatMessage) => void;
  onReceipt: (data: { chatId: string; userId: string; readSeq: number }) => void;
}) {
  const socketRef = useRef<Socket | null>(null);
  const handlers = useRef(params);
  handlers.current = params;

  const [state, setState] = useState<SocketState>({
    connected: false,
    online: new Set(),
    typingByChat: new Map(),
  });

  useEffect(() => {
    if (!params.jwt) return;

    const socket = io({ auth: { token: params.jwt }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setState((prev) => ({ ...prev, connected: true })));
    socket.on('disconnect', () => setState((prev) => ({ ...prev, connected: false })));

    socket.on('msg.new', (message: ChatMessage) => handlers.current.onMessage(message));
    socket.on('receipt', (data: { chatId: string; userId: string; readSeq: number }) =>
      handlers.current.onReceipt(data)
    );

    // El snapshot llega al conectar y trae a TODOS los que ya están en línea.
    // Sin él, los puntos verdes solo aparecerían para quien se conecte después
    // que yo (la lección de F4).
    //
    // Viene como `{online: [...]}` y NO como un array pelado. Escribir el
    // contrato de memoria costó una pantalla en blanco: `new Set(objeto)` tira
    // «object is not iterable» y se lleva puesta toda la app.
    socket.on('presence.snapshot', (data: { online?: string[] }) =>
      setState((prev) => ({ ...prev, online: new Set(data?.online ?? []) }))
    );

    // UN solo evento con un booleano, no dos eventos distintos.
    socket.on('presence', (data: { userId: string; online: boolean }) =>
      setState((prev) => {
        const online = new Set(prev.online);
        if (data.online) online.add(data.userId);
        else online.delete(data.userId);
        return { ...prev, online };
      })
    );

    socket.on('typing', (data: { chatId: string; userId: string; on: boolean }) => {
      setState((prev) => {
        const typingByChat = new Map(prev.typingByChat);
        if (data.on) typingByChat.set(data.chatId, data.userId);
        else typingByChat.delete(data.chatId);
        return { ...prev, typingByChat };
      });
      if (!data.on) return;
      // «Escribiendo» se APAGA solo. El evento de fin puede perderse —una
      // pestaña que se cierra no avisa— y el cartel quedaría encendido para
      // siempre, que se lee como la app colgada.
      setTimeout(() => {
        setState((prev) => {
          const typingByChat = new Map(prev.typingByChat);
          typingByChat.delete(data.chatId);
          return { ...prev, typingByChat };
        });
      }, 4000);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [params.jwt]);

  return { ...state, socket: socketRef };
}

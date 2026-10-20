import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { aplicarReaccion, type Reaccion } from '@lilachat/shared';
import { marcarBorradoGuardado, marcarEditadoGuardado, marcarReaccionesGuardadas } from './mensajesGuardados';
import { getSocket } from './socketClient';
import type { ChatMessage } from './useChat';

type Fijar = Dispatch<SetStateAction<ChatMessage[]>>;
export type RespuestaDeReaccion = { ok: boolean; motivo?: string };

/** Las reacciones de un `seq`, en la lista y en el disco. */
function ponerReacciones(setMessages: Fijar, chatId: string, seq: number, reacciones: Reaccion[]) {
  setMessages((actuales) => actuales.map((m) => (m.seq === seq ? { ...m, reacciones } : m)));
  void marcarReaccionesGuardadas(chatId, seq, reacciones);
}

/**
 * Lo que le pasa a un mensaje YA enviado (salió de `useChat`, que pasaba de 600
 * líneas): borrado para todos, editado y reacciones (20/10). Lo borrado y lo
 * editado esperan el eco del server; la reacción se pinta al tocar (como
 * WhatsApp) y vuelve atrás si el server dice que no. La lista que llega por
 * `msg.reacciones` siempre gana: es la verdad del server.
 */
export function useCambiosDeMensajes(params: { chatId: string; token: string; yo: string; setMessages: Fijar; mensajes: readonly ChatMessage[] }) {
  const { chatId, token, yo, setMessages } = params;
  const mensajesRef = useRef(params.mensajes);
  mensajesRef.current = params.mensajes;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    let vivo = true;
    // La lápida: no se saca de la lista (el `seq` sostiene el orden y la sincronización).
    const onDeleted = (frame: { chatId: string; seq: number }) => {
      if (!vivo || frame.chatId !== chatId) return;
      setMessages((actuales) =>
        actuales.map((m) => (m.seq === frame.seq ? { ...m, deletedAt: new Date().toISOString(), body: undefined, media: undefined, envelope: undefined, reacciones: undefined } : m))
      );
      void marcarBorradoGuardado(chatId, frame.seq);
    };
    const onEdited = (frame: { chatId: string; seq: number; body: string; editedAt: string }) => {
      if (!vivo || frame.chatId !== chatId) return;
      setMessages((actuales) => actuales.map((m) => (m.seq === frame.seq ? { ...m, body: frame.body, editedAt: frame.editedAt } : m)));
      void marcarEditadoGuardado(chatId, frame.seq, frame.body, frame.editedAt);
    };
    const onReacciones = (frame: { chatId: string; seq: number; reacciones: Reaccion[] }) => {
      if (vivo && frame.chatId === chatId && Array.isArray(frame.reacciones)) ponerReacciones(setMessages, chatId, frame.seq, frame.reacciones);
    };
    socket.on('msg.deleted', onDeleted);
    socket.on('msg.edited', onEdited);
    socket.on('msg.reacciones', onReacciones);
    return () => {
      vivo = false;
      socket.off('msg.deleted', onDeleted);
      socket.off('msg.edited', onEdited);
      socket.off('msg.reacciones', onReacciones);
    };
  }, [chatId, token, setMessages]);

  /** `emoji` la pone o la cambia; `null` la quita. */
  const reaccionar = useCallback(
    (seq: number, emoji: string | null): Promise<RespuestaDeReaccion> => {
      const socket = getSocket();
      if (!socket?.connected) return Promise.resolve({ ok: false, motivo: 'Sin conexión: la reacción no se envió.' });
      const antes = mensajesRef.current.find((m) => m.seq === seq)?.reacciones;
      ponerReacciones(setMessages, chatId, seq, aplicarReaccion(antes, yo, emoji, new Date().toISOString()));
      return new Promise((resolve) => {
        socket.timeout(8000).emit('msg.react', { chatId, seq, emoji }, (error: unknown, r: unknown) => {
          const respuesta = (r ?? {}) as { ok?: boolean; motivo?: string };
          if (!error && respuesta.ok) return resolve({ ok: true });
          ponerReacciones(setMessages, chatId, seq, antes ?? []);
          resolve({ ok: false, motivo: respuesta.motivo ?? 'No se pudo reaccionar.' });
        });
      });
    },
    [chatId, yo, setMessages]
  );

  return { reaccionar };
}

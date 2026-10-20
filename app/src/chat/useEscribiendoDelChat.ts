import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSocket, getSocket } from './socketClient';

/** Sin una tecla en este tiempo, se apaga solo. */
const APAGADO_MS = 6000;

const sin = (prev: Set<string>, quien: string) => {
  if (!prev.has(quien)) return prev;
  const next = new Set(prev);
  next.delete(quien);
  return next;
};

/**
 * Quiénes están escribiendo AHORA en este chat (salió de `useChat`, que pasaba
 * de 600 líneas). «Escribiendo» se APAGA solo: el otro manda `on:true`
 * mientras teclea y `on:false` al parar, pero si su app se cierra el `false` no
 * llega nunca. El timer de 6 s es la red de seguridad; cada tecla lo reinicia.
 * Y cuando llega su mensaje se apaga en el acto, como WhatsApp.
 */
export function useEscribiendoDelChat(chatId: string, yo: string, token: string) {
  const [escribiendo, setEscribiendo] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dejoDeEscribir = useCallback((quien: string) => {
    const temporizador = timers.current.get(quien);
    if (temporizador) clearTimeout(temporizador);
    timers.current.delete(quien);
    setEscribiendo((prev) => sin(prev, quien));
  }, []);

  useEffect(() => {
    // Corre antes que el efecto de `useChat` que abre el socket: si todavía no existe, se abre acá.
    const socket = getSocket() ?? connectSocket(token);
    const mapa = timers.current;
    const onTyping = (frame: { chatId: string; userId: string; on: boolean }) => {
      if (frame.chatId !== chatId || frame.userId === yo) return;
      dejoDeEscribir(frame.userId);
      if (!frame.on) return;
      setEscribiendo((prev) => (prev.has(frame.userId) ? prev : new Set(prev).add(frame.userId)));
      mapa.set(frame.userId, setTimeout(() => dejoDeEscribir(frame.userId), APAGADO_MS));
    };
    socket.on('typing', onTyping);
    return () => {
      socket.off('typing', onTyping);
      for (const t of mapa.values()) clearTimeout(t);
      mapa.clear();
      setEscribiendo(new Set());
    };
  }, [chatId, yo, token, dejoDeEscribir]);

  return { escribiendo, dejoDeEscribir };
}

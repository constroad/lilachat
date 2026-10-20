import { useCallback, useRef } from 'react';
import { debeAvisarEscribiendo, REPETIR_ESCRIBIENDO_MS } from '@lilachat/shared';
import { getSocket } from './socketClient';

/**
 * Avisar que estoy escribiendo. Se llama en cada tecla; manda `on:true` al
 * empezar y lo RENUEVA cada pocos segundos (`debeAvisarEscribiendo`: en un
 * párrafo largo el otro lo apagaba), y programa el `on:false` para 3 s
 * después de la ÚLTIMA tecla — sin eso, o no se apaga nunca, o se manda un
 * evento por letra.
 */
export function useAvisoDeEscribiendo(chatId: string): () => void {
  const ultimoAvisoDeEscribiendo = useRef<number | null>(null);
  const typingOffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    const ahora = Date.now();
    if (debeAvisarEscribiendo({ ultimoAviso: ultimoAvisoDeEscribiendo.current, ahora })) {
      ultimoAvisoDeEscribiendo.current = ahora;
      socket.emit('typing', { chatId, on: true });
    }
    if (typingOffTimer.current) clearTimeout(typingOffTimer.current);
    typingOffTimer.current = setTimeout(() => {
      ultimoAvisoDeEscribiendo.current = null;
      getSocket()?.emit('typing', { chatId, on: false });
    }, REPETIR_ESCRIBIENDO_MS);
  }, [chatId]);
}

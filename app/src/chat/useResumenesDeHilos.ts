import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { aplicarResumenDeHilo, type ResumenDeHiloEnCliente } from '@lilachat/shared';
import { hilosDelChat } from '../api/client';
import { guardarMensajes } from './mensajesGuardados';
import { getSocket } from './socketClient';
import type { ChatMessage } from './useChat';

/**
 * El chip de cada raíz al día (E3, 20/10): «4 respuestas · última 10:42». En
 * vivo por `msg.hilo`, y al conectar se piden los resúmenes del chat (lo que
 * cambió mientras el teléfono estaba desconectado): un pedido por conexión,
 * no por mensaje. Va después del efecto de `useChat`, que abre el socket.
 */
export function useResumenesDeHilos(params: { chatId: string; token: string; setMessages: Dispatch<SetStateAction<ChatMessage[]>> }) {
  const { chatId, token, setMessages } = params;
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    let vivo = true;
    const poner = (raiz: number, hilo: ResumenDeHiloEnCliente) =>
      setMessages((actuales) => {
        const nuevos = aplicarResumenDeHilo(actuales, raiz, hilo);
        const raizNueva = nuevos.find((mensaje) => mensaje.seq === raiz);
        if (nuevos !== actuales && raizNueva) void guardarMensajes(chatId, [raizNueva]);
        return nuevos;
      });
    const onHilo = (frame: { chatId?: string; raiz?: number; hilo?: ResumenDeHiloEnCliente }) => {
      if (vivo && frame.chatId === chatId && typeof frame.raiz === 'number' && frame.hilo) poner(frame.raiz, frame.hilo);
    };
    const alConectar = () =>
      void hilosDelChat(token, chatId).then((respuesta) => {
        if (respuesta.ok && vivo) respuesta.data.hilos.forEach(({ raiz, hilo }) => poner(raiz, hilo));
      });
    socket.on('msg.hilo', onHilo);
    socket.on('connect', alConectar);
    if (socket.connected) alConectar();
    return () => {
      vivo = false;
      socket.off('msg.hilo', onHilo);
      socket.off('connect', alConectar);
    };
  }, [chatId, token, setMessages]);
}

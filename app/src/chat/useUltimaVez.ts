import { useEffect, useState } from 'react';
import { alConectar, getSocket } from './socketClient';

/** Cuánto esperar la respuesta del server (ms): sin ella, el subtítulo queda vacío. */
const ESPERA_ULTIMA_VEZ_MS = 8000;

/**
 * La «últ. vez» del otro de un 1:1 (FL10, auditoría §46.3), en ISO.
 *
 * Se pide al abrir y en cada reconexión (con la app en segundo plano el socket
 * se pausa, y el otro pudo irse mientras tanto). En vivo la trae el aviso
 * `presence` del server cuando el otro se va.
 */
export function useUltimaVez(otroId: string | null | undefined): string | undefined {
  const [ultimaVez, setUltimaVez] = useState<string>();
  useEffect(() => {
    const socket = getSocket();
    if (!otroId || !socket) return;
    let vivo = true;
    const pedir = async () => {
      if (!socket.connected) return;
      const respuesta = (await socket
        .timeout(ESPERA_ULTIMA_VEZ_MS)
        .emitWithAck('presence.ultimaVez', { userId: otroId })
        .catch(() => null)) as { lastSeenAt?: string | null } | null;
      if (vivo && respuesta?.lastSeenAt) setUltimaVez(respuesta.lastSeenAt);
    };
    const alIrse = (frame: { userId: string; online: boolean; lastSeenAt?: string }) => {
      if (frame.userId === otroId && !frame.online && frame.lastSeenAt) setUltimaVez(frame.lastSeenAt);
    };
    socket.on('presence', alIrse);
    const dejarDeEscuchar = alConectar(() => void pedir());
    void pedir();
    return () => {
      vivo = false;
      socket.off('presence', alIrse);
      dejarDeEscuchar();
    };
  }, [otroId]);
  return ultimaVez;
}

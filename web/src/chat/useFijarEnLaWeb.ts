import { useCallback, useState } from 'react';
import type { DuracionDeFijado } from '@lilachat/shared';
import { api } from '../api';

/**
 * Fijar y desfijar desde la web (19/10). `pidiendo` es el mensaje que espera
 * su duración (el diálogo). Tras cada cambio se relee la lista: los fijados
 * viajan con ella (y a los demás les llega `chat.changed`).
 */
export function useFijarEnLaWeb(params: { chatId: string; jwt: string; onAviso: (texto: string) => void; onCambio: () => void }) {
  const { chatId, jwt, onAviso, onCambio } = params;
  const [pidiendo, setPidiendo] = useState<number | null>(null);

  const fijar = useCallback(
    async (duracion: DuracionDeFijado) => {
      if (pidiendo === null) return;
      const seq = pidiendo;
      setPidiendo(null);
      const respuesta = await api(`/chats/${chatId}/fijados`, { method: 'POST', body: { seq, duracion }, jwt });
      if (!respuesta.ok) return onAviso(respuesta.message);
      onCambio();
    },
    [pidiendo, chatId, jwt, onAviso, onCambio]
  );

  const desfijar = useCallback(
    async (seq: number) => {
      const respuesta = await api(`/chats/${chatId}/fijados/${seq}`, { method: 'DELETE', jwt });
      if (!respuesta.ok) return onAviso(respuesta.message);
      onCambio();
    },
    [chatId, jwt, onAviso, onCambio]
  );

  return { pidiendo, pedir: setPidiendo, cancelar: () => setPidiendo(null), fijar, desfijar };
}

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { baseDe, type BaseLocal } from './baseLocal';
import { mensajesDelChat } from './mensajesLocales';
import { juntarConPendientes } from './enPantalla';
import { ocultosDe } from './ocultos';
import type { ChatSummary, MensajeEnPantalla } from '../chat/types';

/** La base de quien entró; `null` sin sesión. */
export function useBaseLocal(userId: string | null): BaseLocal | null {
  return useMemo(() => (userId ? baseDe(userId) : null), [userId]);
}

/** La lista de chats, viva: cambia sola cuando la sincronización escribe. `null` = cargando. */
export function useChatsLocales(base: BaseLocal | null): ChatSummary[] | null {
  return useLiveQuery(async () => (base ? base.chats.toArray() : []), [base], null);
}

/**
 * Lo que se dibuja de un chat: los últimos `limite` confirmados MÁS lo que está
 * en la cola (enviando o fallido), en orden. `null` = todavía leyendo.
 */
export function useMensajesEnPantalla(
  base: BaseLocal | null,
  chatId: string | null,
  limite: number,
  yo: string
): MensajeEnPantalla[] | null {
  return useLiveQuery(
    async () => {
      if (!base || !chatId) return [];
      const [confirmados, cola, ocultos] = await Promise.all([
        mensajesDelChat(base, chatId, limite),
        base.cola.where('chatId').equals(chatId).toArray(),
        ocultosDe(base, chatId),
      ]);
      // «Eliminar para mí» (W2): se oculta en este navegador.
      const visibles = ocultos.size ? confirmados.filter((uno) => !ocultos.has(uno.seq)) : confirmados;
      return juntarConPendientes(visibles, cola, yo);
    },
    [base, chatId, limite, yo],
    null
  );
}

import { useSyncExternalStore } from 'react';
import { chatsEnMemoria, suscribirChatsEnMemoria } from './chatsGuardados';

/**
 * Lo que la lista sabe de los acuses de un chat, como texto (estable para
 * `useSyncExternalStore`). La lista los recibe en vivo y los relee del server
 * al reconectar; el chat abierto partía de una foto vieja (los parámetros de la
 * ruta) y se quedaba en un check después de un corte (auditoría 19/10).
 */
export function acuseVivo(chats: readonly { id: string; othersReadSeq: number; othersDeliveredSeq: number }[] | null, chatId: string): string {
  const chat = chats?.find((uno) => uno.id === chatId);
  return chat ? `${chat.othersReadSeq}:${chat.othersDeliveredSeq}` : '0:0';
}

export function useAcuseVivo(chatId: string): { leido: number; entregado: number } {
  const texto = useSyncExternalStore(suscribirChatsEnMemoria, () => acuseVivo(chatsEnMemoria(), chatId));
  const [leido, entregado] = texto.split(':').map(Number);
  return { leido: leido ?? 0, entregado: entregado ?? 0 };
}

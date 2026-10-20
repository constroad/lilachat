import type { OutboxItem } from '@lilachat/shared';
import type { ChatMessage, MensajeEnPantalla } from '../chat/types';

/**
 * Lo confirmado más lo de la cola, como se dibuja. Lo pendiente va al final, en
 * el orden en que se escribió, y un pendiente que ya está confirmado (el eco
 * llegó antes de vaciar la cola) no sale dos veces.
 */
export function juntarConPendientes(confirmados: ChatMessage[], cola: OutboxItem[], yo: string): MensajeEnPantalla[] {
  const yaEstan = new Set(confirmados.map((uno) => uno.clientKey));
  const pendientes = cola
    .filter((item) => !yaEstan.has(item.clientKey))
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
    .map(
      (item): MensajeEnPantalla => ({
        chatId: item.chatId,
        seq: Number.MAX_SAFE_INTEGER,
        senderId: yo,
        clientKey: item.clientKey,
        kind: item.kind,
        body: item.body,
        menciones: item.menciones,
        replyToSeq: item.replyToSeq,
        ...(item.hiloDe !== undefined ? { hiloDe: item.hiloDe } : {}),
        ...(item.enElChat ? { enElChat: true } : {}),
        at: item.queuedAt,
        estado: item.fallo ? 'fallido' : 'enviando',
        motivoDelFallo: item.fallo,
      })
    );
  return [...confirmados, ...pendientes];
}

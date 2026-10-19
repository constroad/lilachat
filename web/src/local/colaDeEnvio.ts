import {
  enqueue,
  nextPending,
  resolveOutcome,
  type OutboxEffect,
  type OutboxItem,
  type SendOutcome,
} from '@lilachat/shared';
import type { BaseLocal } from './baseLocal';
import type { ChatMessage } from '../chat/types';

/**
 * La cola de envío de la web (W1), sobre el MISMO motor que la app
 * (`shared/outbox.ts`): `clientKey` que no cambia, duplicado = éxito, un
 * rechazo permanente no traba a los de atrás y 401 marca todo sin borrar.
 *
 * Lo nuevo es que vive en IndexedDB: cerrar la pestaña sin red ya no pierde
 * lo escrito, y se manda al volver.
 */

const enOrden = (cola: OutboxItem[]) => [...cola].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));

export async function encolarEnvio(base: BaseLocal, item: OutboxItem): Promise<void> {
  await base.transaction('rw', base.cola, async () => {
    const actual = await base.cola.toArray();
    if (enqueue(actual, item) !== actual) await base.cola.put(item);
  });
}

export const reintentarEnvio = (base: BaseLocal, clientKey: string) =>
  base.cola.where('clientKey').equals(clientKey).modify((item: OutboxItem) => {
    delete item.fallo;
    item.attempts = 0;
  });

export const descartarEnvio = (base: BaseLocal, clientKey: string) => base.cola.delete(clientKey);

/** Lo confirmado pasa a los mensajes con su `seq`: el eco de `msg.new` lo completa. */
function confirmado(item: OutboxItem, seq: number, yo: string): ChatMessage {
  return {
    chatId: item.chatId,
    seq,
    senderId: yo,
    clientKey: item.clientKey,
    kind: item.kind,
    body: item.body,
    menciones: item.menciones,
    replyToSeq: item.replyToSeq,
    at: item.queuedAt,
  };
}

async function aplicarEfecto(base: BaseLocal, item: OutboxItem, efecto: OutboxEffect, yo: string): Promise<void> {
  await base.transaction('rw', base.cola, base.mensajes, async () => {
    if (efecto.action === 'confirm') {
      await base.cola.delete(item.clientKey);
      const yaEsta = await base.mensajes.get([item.chatId, efecto.seq]);
      if (!yaEsta) await base.mensajes.put(confirmado(item, efecto.seq, yo));
    } else if (efecto.action === 'fail') {
      await base.cola.update(item.clientKey, { fallo: efecto.reason });
    } else if (efecto.action === 'retry') {
      await base.cola.update(item.clientKey, { attempts: item.attempts + 1 });
    } else {
      await base.cola.toCollection().modify((uno: OutboxItem) => {
        if (!uno.fallo) uno.fallo = efecto.reason;
      });
    }
  });
}

/** Un drenado por base a la vez: dos en paralelo mandarían dos veces lo mismo. */
const enCurso = new WeakMap<BaseLocal, Promise<{ reintentarEn?: number }>>();

/**
 * Manda lo pendiente, en orden, hasta vaciar o hasta que falte la red. Nunca
 * lanza. Devuelve en cuánto reintentar si quedó algo por la red.
 */
export function drenarCola(params: {
  base: BaseLocal;
  yo: string;
  enviar: (item: OutboxItem) => Promise<SendOutcome>;
}): Promise<{ reintentarEn?: number }> {
  const actual = enCurso.get(params.base);
  if (actual) return actual;
  const corrida = drenar(params).finally(() => enCurso.delete(params.base));
  enCurso.set(params.base, corrida);
  return corrida;
}

async function drenar({ base, yo, enviar }: Parameters<typeof drenarCola>[0]): Promise<{ reintentarEn?: number }> {
  for (;;) {
    const siguiente = nextPending(enOrden(await base.cola.toArray()));
    if (!siguiente) return {};
    const efecto = resolveOutcome(siguiente, await enviar(siguiente).catch((): SendOutcome => ({ status: 'unreachable' })));
    await aplicarEfecto(base, siguiente, efecto, yo);
    if (efecto.action === 'retry') return { reintentarEn: efecto.delayMs };
    if (efecto.action === 'fail-all') return {};
  }
}

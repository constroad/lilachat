import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyEffect,
  enqueue,
  nextPending,
  resolveOutcome,
  type OutboxItem,
} from '@lilachat/shared';
import { sendOverSocket } from './socketClient';

/**
 * La cola de salida, PERSISTIDA. Cerrar la app no puede perder lo escrito: el
 * chofer del caso Timón perdía la marca, acá se perdería un mensaje.
 *
 * Va en AsyncStorage y no en SecureStore a propósito: lo encolado es contenido
 * del usuario, no una credencial, y SecureStore tiene un tope chico por clave.
 * Nada sensible se guarda acá (el JWT vive en el llavero).
 */
const STORAGE_KEY = 'lilachat-outbox';

let queue: OutboxItem[] = [];
let hydrated = false;
let draining = false;
const listeners = new Set<(items: OutboxItem[]) => void>();

/** Store con SUSCRIPTORES: sin esto, la pantalla no se entera de los cambios
 *  y el mensaje sigue viéndose «pendiente» aunque ya se confirmó. */
function notify(): void {
  for (const listener of listeners) listener(queue);
}

export function subscribeOutbox(listener: (items: OutboxItem[]) => void): () => void {
  listeners.add(listener);
  listener(queue);
  return () => listeners.delete(listener);
}

async function persist(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue)).catch(() => undefined);
}

export async function hydrateOutbox(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  if (raw) {
    try {
      queue = JSON.parse(raw) as OutboxItem[];
    } catch {
      queue = [];
    }
  }
  notify();
}

export async function queueMessage(item: OutboxItem): Promise<void> {
  queue = enqueue(queue, item);
  notify();
  await persist();
  void drainOutbox();
}

export type DrainReport = { confirmed: number; discarded: string[]; cleared: boolean };

/**
 * Vacía la cola en orden estricto. **Se detiene ante el primer reintento**: los
 * mensajes de un chat tienen que llegar en el orden en que se escribieron, así
 * que no se saltea el que falló para mandar el siguiente.
 */
export async function drainOutbox(): Promise<DrainReport> {
  const report: DrainReport = { confirmed: 0, discarded: [], cleared: false };
  if (draining) return report;
  draining = true;
  try {
    for (;;) {
      const item = nextPending(queue);
      if (!item) break;

      const outcome = await sendOverSocket({
        chatId: item.chatId,
        clientKey: item.clientKey,
        body: item.body,
        kind: item.kind,
      });
      const effect = resolveOutcome(item, outcome);
      queue = applyEffect(queue, effect);
      notify();
      await persist();

      if (effect.action === 'confirm') {
        report.confirmed += 1;
        continue;
      }
      if (effect.action === 'discard') {
        report.discarded.push(effect.reason);
        continue;
      }
      if (effect.action === 'clear-all') {
        report.cleared = true;
        break;
      }
      // retry: se corta acá y se reintenta cuando el socket vuelva.
      break;
    }
  } finally {
    draining = false;
  }
  return report;
}

/** Solo para tests: reinicia el módulo. */
export function __resetOutbox(): void {
  queue = [];
  hydrated = false;
  draining = false;
  listeners.clear();
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyEffect,
  descartarDeLaCola,
  enqueue,
  nextPending,
  reintentarEnLaCola,
  resolveOutcome,
  type OutboxItem,
} from '@lilachat/shared';
import { alConectar, sendOverSocket } from './socketClient';
import { anotarEnvio } from './reenviar/frecuenciasDeEnvio';

/**
 * La cola de salida, PERSISTIDA.
 *
 * En los chats secretos lo encolado ya viene CIFRADO (`buildOutboxItem`): el
 * texto plano no llega nunca a este archivo ni al disco. Cerrar la app no puede perder lo escrito: el
 * chofer del caso Timón perdía la marca, acá se perdería un mensaje.
 *
 * Va en AsyncStorage y no en SecureStore a propósito: lo encolado es contenido
 * del usuario, no una credencial, y SecureStore tiene un tope chico por clave.
 * Nada sensible se guarda acá (el JWT vive en el llavero).
 */
const STORAGE_KEY = 'lilachat-outbox';

let queue: OutboxItem[] = [];
let draining = false;
/** El reintento programado: uno solo, el próximo. */
let reintento: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(items: OutboxItem[]) => void>();

/** Store con SUSCRIPTORES: sin esto, la pantalla no se entera de los cambios
 *  y el mensaje sigue viéndose «pendiente» aunque ya se confirmó. */
function notify(): void {
  for (const listener of listeners) listener(queue);
}

/** Messages still waiting to leave: an OTA reload must not happen while any is pending. */
export function pendingOutboxCount(): number {
  return queue.length;
}

export function subscribeOutbox(listener: (items: OutboxItem[]) => void): () => void {
  listeners.add(listener);
  listener(queue);
  return () => listeners.delete(listener);
}

async function persist(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue)).catch(() => undefined);
}

/**
 * Una sola lectura del disco, compartida: quien llega mientras se lee espera
 * la MISMA promesa. Con un simple «ya empecé», un `drainOutbox` que entraba en
 * ese momento veía la cola vacía y no mandaba nada.
 */
let hidratando: Promise<void> | null = null;

export function hydrateOutbox(): Promise<void> {
  if (!hidratando) {
    hidratando = (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      if (raw) {
        try {
          // Lo encolado mientras se leía (raro) se conserva al final.
          queue = [...(JSON.parse(raw) as OutboxItem[]), ...queue.filter((item) => !raw.includes(item.clientKey))];
        } catch {
          // Un JSON roto no puede trabar la app: se arranca con lo que haya.
        }
      }
      notify();
    })();
  }
  return hidratando;
}

export async function queueMessage(item: OutboxItem): Promise<void> {
  queue = enqueue(queue, item);
  notify();
  // Los «Chats frecuentes» al reenviar salen de acá (20/10).
  void anotarEnvio(item.chatId);
  await persist();
  void drainOutbox();
}

/**
 * La cola sale SOLA cada vez que el socket conecta, esté abierto un chat o no
 * (FL8). Antes solo la vaciaba la pantalla de un chat: escrito sin red, se
 * volvía a la lista y nada salía hasta reabrir alguno.
 */
alConectar(() => void drainOutbox());

/** «Reintentar» sobre un mensaje que no se envió. */
export async function reintentarMensaje(clientKey: string): Promise<void> {
  queue = reintentarEnLaCola(queue, clientKey);
  notify();
  await persist();
  void drainOutbox();
}

/** «Borrar» un mensaje que no se envió. */
export async function descartarMensaje(clientKey: string): Promise<void> {
  queue = descartarDeLaCola(queue, clientKey);
  notify();
  await persist();
}

function programarReintento(delayMs: number): void {
  if (reintento) clearTimeout(reintento);
  reintento = setTimeout(() => {
    reintento = null;
    void drainOutbox();
  }, delayMs);
}

export type DrainReport = { confirmed: number; failed: string[] };

/**
 * Vacía la cola en orden estricto. **Se detiene ante el primer reintento**: los
 * mensajes de un chat tienen que llegar en el orden en que se escribieron, así
 * que no se saltea el que falló para mandar el siguiente.
 */
export async function drainOutbox(): Promise<DrainReport> {
  const report: DrainReport = { confirmed: 0, failed: [] };
  if (draining) return report;
  draining = true;
  try {
    // Puede llamarse al conectar, antes de que ninguna pantalla hidrate.
    await hydrateOutbox();
    for (;;) {
      const item = nextPending(queue);
      if (!item) break;

      const outcome = await sendOverSocket({
        chatId: item.chatId,
        clientKey: item.clientKey,
        body: item.body,
        // El sobre viaja tal cual salió de la cola. Sin esta línea el mensaje
        // llegaba al server SIN texto y SIN sobre —el body ya no existe en un
        // chat cifrado— y se guardaba una burbuja vacía.
        envelope: item.envelope,
        kind: item.kind,
        // A qué mensaje responde, si es una respuesta. Sin esto el reply se
        // guardaba sin su cita: `buildOutboxItem` lo tenia y aca se perdia.
        replyToSeq: item.replyToSeq,
        menciones: item.menciones,
        // E3: sin esto la respuesta caía en el chat y no en su hilo.
        hiloDe: item.hiloDe,
        enElChat: item.enElChat,
      });
      const effect = resolveOutcome(item, outcome);
      queue = applyEffect(queue, effect);
      notify();
      await persist();

      if (effect.action === 'confirm') {
        report.confirmed += 1;
        continue;
      }
      if (effect.action === 'fail') {
        // Queda en pantalla como «No se envió»; la cola sigue con el resto.
        report.failed.push(effect.reason);
        continue;
      }
      if (effect.action === 'fail-all') {
        report.failed.push(effect.reason);
        break;
      }
      // retry: se corta acá (el orden importa) y se reintenta con espera
      // creciente. Antes solo se reintentaba al reconectar: con el socket
      // conectado y un ack que no llegó, el reloj quedaba para siempre.
      programarReintento(effect.delayMs);
      break;
    }
  } finally {
    draining = false;
  }
  return report;
}

/**
 * Cerrar sesión vacía la cola (FL8): lo que quedó sin mandar es de quien se
 * fue. Si quedara, quien entre después la heredaría.
 */
export async function olvidarCola(): Promise<void> {
  queue = [];
  if (reintento) clearTimeout(reintento);
  reintento = null;
  notify();
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

/** Solo para tests: reinicia el módulo. */
export function __resetOutbox(): void {
  queue = [];
  hidratando = null;
  draining = false;
  if (reintento) clearTimeout(reintento);
  reintento = null;
  listeners.clear();
}

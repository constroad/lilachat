import Dexie, { type Table } from 'dexie';
import type { OutboxItem } from '@lilachat/shared';
import type { ChatMessage, ChatSummary } from '../chat/types';

/**
 * La base local de la web (W1): IndexedDB es la fuente de la pantalla.
 *
 * Es el modelo de WhatsApp Web. El socket y la sincronización ESCRIBEN acá, y
 * la UI LEE de acá con consultas vivas: abrir un chat es leer local, sin
 * esqueletos ni ida y vuelta a la red.
 *
 * Reglas:
 * - **Una base por usuario** (`lilachat-<userId>`). Un navegador compartido no
 *   mezcla el historial de dos personas, y cerrar sesión borra la base entera.
 * - `mensajes` guarda SOLO lo confirmado por el server, con clave
 *   `[chatId+seq]`: el eco de `msg.new` y la página del historial pisan la
 *   misma fila en vez de duplicarla.
 * - Lo que todavía no confirmó vive en `cola`, con clave `clientKey`. Se junta
 *   con los mensajes recién al pintar.
 * - Un chat secreto llega como sobre (`envelope`, sin `body`): se guarda tal
 *   cual. La web no lo abre, así que nunca hay texto en claro que proteger.
 */
export type ValorMeta = { clave: string; valor: unknown };

export class BaseLocal extends Dexie {
  chats!: Table<ChatSummary, string>;
  mensajes!: Table<ChatMessage, [string, number]>;
  cola!: Table<OutboxItem, string>;
  meta!: Table<ValorMeta, string>;

  constructor(nombre: string) {
    super(nombre);
    this.version(1).stores({
      chats: 'id',
      mensajes: '[chatId+seq], chatId, clientKey',
      cola: 'clientKey, chatId, queuedAt',
      meta: 'clave',
    });
  }
}

export const nombreDeLaBase = (userId: string): string => `lilachat-${userId}`;

const abiertas = new Map<string, BaseLocal>();

/** La base de ESTE usuario, abierta una sola vez por pestaña. */
export function baseDe(userId: string): BaseLocal {
  const nombre = nombreDeLaBase(userId);
  let base = abiertas.get(nombre);
  if (!base) {
    base = new BaseLocal(nombre);
    abiertas.set(nombre, base);
  }
  return base;
}

/**
 * Cerrar sesión: la base se borra entera. El historial no se hereda en un
 * navegador, y lo próximo que pase puede ser que otra persona abra la pestaña.
 */
export async function borrarBaseDe(userId: string): Promise<void> {
  const nombre = nombreDeLaBase(userId);
  abiertas.get(nombre)?.close();
  abiertas.delete(nombre);
  await Dexie.delete(nombre);
}

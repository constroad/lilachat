import Dexie from 'dexie';
import { conciliarPagina, seqsQueSobran, type Cursors, type Reaccion } from '@lilachat/shared';
import type { BaseLocal } from './baseLocal';
import type { ChatMessage, ChatSummary } from '../chat/types';

/**
 * Escribir y leer la base local (W1). Todo lo que llega del server pasa por
 * acá; la pantalla solo LEE (consultas vivas en `useBaseLocal`).
 */

const rangoDelChat = (chatId: string, desde: number = Dexie.minKey as number) =>
  [
    [chatId, desde],
    [chatId, Dexie.maxKey],
  ] as const;

/** La lista de chats: el server MANDA. Un chat borrado desde el teléfono se va. */
export async function guardarChats(base: BaseLocal, chats: ChatSummary[]): Promise<void> {
  await base.transaction('rw', base.chats, async () => {
    await base.chats.clear();
    await base.chats.bulkPut(chats);
  });
}

/**
 * Una página del historial. Dentro de SU rango de `seq` el server es la
 * verdad: lo guardado que ya no está se borra (`conciliarPagina`). Lo de más
 * atrás no lo mencionó, así que se queda.
 */
export async function guardarPagina(
  base: BaseLocal,
  chatId: string,
  pagina: ChatMessage[],
  ultimoDelServer?: number
): Promise<void> {
  if (pagina.length === 0) return;
  const desde = Math.min(...pagina.map((uno) => uno.seq));
  await base.transaction('rw', base.mensajes, async () => {
    const [inicio, fin] = rangoDelChat(chatId, desde);
    const guardados = await base.mensajes.where('[chatId+seq]').between(inicio, fin, true, true).toArray();
    const sobran = seqsQueSobran(guardados, conciliarPagina(guardados, pagina, ultimoDelServer));
    await base.mensajes.bulkDelete(sobran.map((seq) => [chatId, seq] as [string, number]));
    await base.mensajes.bulkPut(pagina);
  });
}

/**
 * Un mensaje en vivo (`msg.new`) o de la sincronización. La clave `[chatId+seq]`
 * hace que el eco pise la misma fila; y si es MÍO, sale de la cola.
 */
export async function aplicarEntrante(base: BaseLocal, mensaje: ChatMessage): Promise<void> {
  await base.transaction('rw', base.mensajes, base.cola, async () => {
    await base.mensajes.put(mensaje);
    if (mensaje.clientKey) await base.cola.delete(mensaje.clientKey);
  });
}

/** Borrado para todos: queda la lápida, sin texto, sobre ni adjunto. */
export async function aplicarBorrado(
  base: BaseLocal,
  { chatId, seq, deletedAt }: { chatId: string; seq: number; deletedAt: string }
): Promise<void> {
  await base.transaction('rw', base.mensajes, async () => {
    const actual = await base.mensajes.get([chatId, seq]);
    if (!actual) return;
    const { body: _body, media: _media, envelope: _envelope, ...resto } = actual;
    await base.mensajes.put({ ...resto, deletedAt });
  });
}

/** Edición: el texto nuevo y la marca «Editado». */
export async function aplicarEdicion(
  base: BaseLocal,
  { chatId, seq, body, editedAt }: { chatId: string; seq: number; body: string; editedAt: string }
): Promise<void> {
  await base.mensajes.where('[chatId+seq]').equals([chatId, seq]).modify({ body, editedAt });
}

/** Los últimos `limite` mensajes de un chat, del más viejo al más nuevo. */
export async function mensajesDelChat(base: BaseLocal, chatId: string, limite: number): Promise<ChatMessage[]> {
  const [inicio, fin] = rangoDelChat(chatId);
  const ultimos = await base.mensajes.where('[chatId+seq]').between(inicio, fin, true, true).reverse().limit(limite).toArray();
  return ultimos.reverse();
}

/**
 * Hasta qué `seq` tengo de cada chat: es lo que se manda en `sync.pull` para
 * recibir SOLO lo que falta. Un chat sin mensajes guardados no va: el server
 * mandaría todo su historial.
 */
export async function cursoresLocales(base: BaseLocal): Promise<Cursors> {
  const ids = (await base.chats.toCollection().primaryKeys()) as string[];
  const cursores: Cursors = {};
  for (const id of ids) {
    const [inicio, fin] = rangoDelChat(id);
    const ultimo = await base.mensajes.where('[chatId+seq]').between(inicio, fin, true, true).last();
    if (ultimo) cursores[id] = ultimo.seq;
  }
  return cursores;
}

/** E3: el resumen nuevo del hilo en su raíz guardada («4 respuestas · última 10:42»). */
export async function aplicarResumenDeHilo(base: BaseLocal, { chatId, raiz, hilo }: { chatId: string; raiz: number; hilo: NonNullable<ChatMessage['hilo']> }): Promise<void> {
  await base.mensajes.where('[chatId+seq]').equals([chatId, raiz]).modify({ hilo });
}

/** Reacciones (20/10): la lista que manda el server reemplaza la guardada. */
export async function aplicarReacciones(base: BaseLocal, { chatId, seq, reacciones }: { chatId: string; seq: number; reacciones: Reaccion[] }): Promise<void> {
  await base.mensajes.where('[chatId+seq]').equals([chatId, seq]).modify({ reacciones });
}

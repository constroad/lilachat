import { mergeBySeq } from '@lilachat/shared';
import type { ChatMessage } from './useChat';

/**
 * Los últimos mensajes de los chats abiertos hace poco, YA descifrados, en
 * memoria (FL12, §49 #2). PURO.
 *
 * Abrir un chat leía el disco: abrir la base, la clave del Keystore, un SELECT
 * y descifrar 50 filas. Mientras tanto la pantalla entraba vacía deslizándose y
 * las burbujas aparecían 0,3–0,8 s después. WhatsApp desliza la conversación ya
 * pintada: con esto, `useChat` nace con estos mensajes.
 *
 * Solo memoria del proceso, nunca disco: lo persistido sigue siendo el almacén
 * cifrado. Se vacía al cerrar sesión.
 */
export class MemoriaDeChats<T extends { seq: number }> {
  private readonly porChat = new Map<string, readonly T[]>();

  constructor(private readonly tope: { chats: number; mensajes: number }) {}

  /** Lo recordado de ese chat (y lo marca como recién usado), o `null`. */
  de(chatId: string): readonly T[] | null {
    const mensajes = this.porChat.get(chatId);
    if (!mensajes) return null;
    this.porChat.delete(chatId);
    this.porChat.set(chatId, mensajes);
    return mensajes;
  }

  recordar(chatId: string, mensajes: readonly T[]): void {
    // Vacío no dice nada nuevo: puede ser el estado antes de leer el disco.
    if (mensajes.length === 0) return;
    this.porChat.delete(chatId);
    this.porChat.set(chatId, mensajes.slice(-this.tope.mensajes));
    // El Map recuerda el orden de inserción: el primero es el menos usado.
    while (this.porChat.size > this.tope.chats) {
      const masViejo = this.porChat.keys().next().value;
      if (masViejo === undefined) break;
      this.porChat.delete(masViejo);
    }
  }

  /**
   * What was just written to disk, into a chat already in memory (José,
   * 20/10: the scroll kept going on re-entering a chat because this copy was
   * older than the disk). It never creates an entry — `useChat` would start
   * with one row and skip the disk — and it does not refresh the LRU order.
   */
  add(chatId: string, messages: readonly T[]): void {
    const current = this.porChat.get(chatId);
    if (!current || messages.length === 0) return;
    const merged = mergeBySeq([...current], [...messages]);
    if (merged.length === current.length && merged.every((message, index) => message === current[index])) return;
    this.porChat.set(chatId, merged.slice(-this.tope.mensajes));
  }

  /** What the disk removed (the server no longer has it). */
  drop(chatId: string, seqs: readonly number[]): void {
    const current = this.porChat.get(chatId);
    if (!current) return;
    const removed = new Set(seqs);
    const kept = current.filter((message) => !removed.has(message.seq));
    if (kept.length !== current.length) this.porChat.set(chatId, kept);
  }

  olvidar(chatId: string): void {
    this.porChat.delete(chatId);
  }

  olvidarTodo(): void {
    this.porChat.clear();
  }
}

/**
 * The disk page into what the screen already shows, adding only the seqs it
 * lacks (offline, the server check cannot bring them). Same array if nothing
 * is missing, so the list does not re-render or move.
 */
export function addMissingBySeq<T extends { seq: number }>(current: T[], stored: readonly T[]): T[] {
  const present = new Set(current.map((message) => message.seq));
  const missing = stored.filter((message) => !present.has(message.seq));
  if (missing.length === 0) return current;
  return [...current, ...missing].sort((first, second) => first.seq - second.seq);
}

/** Diez chats, cincuenta mensajes: la primera pantalla de los que más se abren. */
export const chatsEnMemoria = new MemoriaDeChats<ChatMessage>({ chats: 10, mensajes: 50 });

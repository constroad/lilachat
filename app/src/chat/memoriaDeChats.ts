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
export class MemoriaDeChats<T> {
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

  olvidar(chatId: string): void {
    this.porChat.delete(chatId);
  }

  olvidarTodo(): void {
    this.porChat.clear();
  }
}

/** Diez chats, cincuenta mensajes: la primera pantalla de los que más se abren. */
export const chatsEnMemoria = new MemoriaDeChats<ChatMessage>({ chats: 10, mensajes: 50 });

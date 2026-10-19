import type { ChatSummary } from '../chat/types';
import type { BaseLocal } from './baseLocal';

/**
 * Cambios del usuario sobre SUS chats (W3a), escritos primero en la base local
 * para que la lista responda al toque. Si el server no acepta, se vuelve atrás
 * con lo que devolvió `ajustarChatLocal`.
 */
export type AjusteLocal = Partial<Pick<ChatSummary, 'archived' | 'muted' | 'pinned' | 'markedUnread' | 'unread'>>;

/** Aplica el ajuste y devuelve los valores de antes (o `null` si el chat ya no está). */
export async function ajustarChatLocal(base: BaseLocal, chatId: string, ajuste: AjusteLocal): Promise<AjusteLocal | null> {
  return base.transaction('rw', base.chats, async () => {
    const actual = await base.chats.get(chatId);
    if (!actual) return null;
    const antes = Object.fromEntries(Object.keys(ajuste).map((campo) => [campo, actual[campo as keyof AjusteLocal]])) as AjusteLocal;
    const siguiente: ChatSummary = { ...actual, ...ajuste };
    // Volver a `undefined` es borrar el campo, no guardarlo como tal.
    for (const [campo, valor] of Object.entries(ajuste)) if (valor === undefined) delete siguiente[campo as keyof AjusteLocal];
    await base.chats.put(siguiente);
    return antes;
  });
}

/** «Eliminar chat» para mí: fuera de la lista, con sus mensajes y lo que esperaba salir. */
export async function quitarChatLocal(base: BaseLocal, chatId: string): Promise<void> {
  await base.transaction('rw', base.chats, base.mensajes, base.cola, async () => {
    await base.chats.delete(chatId);
    await base.mensajes.where('chatId').equals(chatId).delete();
    await base.cola.where('chatId').equals(chatId).delete();
  });
}

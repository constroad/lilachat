import type { ChatSummary } from '../chat/types';
import type { BaseLocal } from './baseLocal';

/**
 * Cambia UNA fila de la lista guardada (auditoría 19/10): la web pedía la
 * lista entera al server —una agregación sobre todos los mensajes— con cada
 * mensaje y cada acuse. Ahora aplica el cambio acá, con las mismas reglas que
 * la app (`listaEnVivo` de shared). Devuelve `false` si el chat no está: es
 * nuevo y solo el server sabe su nombre y sus miembros.
 */
export async function cambiarFila(base: BaseLocal, chatId: string, cambiar: (chats: ChatSummary[]) => ChatSummary[] | null): Promise<boolean> {
  return base.transaction('rw', base.chats, async () => {
    const actual = await base.chats.get(chatId);
    if (!actual) return false;
    const nueva = cambiar([actual])?.[0];
    if (nueva && nueva !== actual) await base.chats.put(nueva);
    return true;
  });
}

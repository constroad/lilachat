import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatSummary } from '../api/client';
import { MAX_CHATS_EN_CACHE } from './cacheDeChats';

/**
 * La última lista de chats conocida, en el teléfono.
 *
 * **Nunca lanza.** Si el archivo no está, está corrupto o el disco falla, se
 * arranca sin caché: perderla solo cuesta ver esqueletos una vez, y romper el
 * arranque por eso sería cambiar una molestia por una app que no abre.
 *
 * Guarda la lista, NO los mensajes. Los cuerpos de los mensajes en un almacén
 * sin cifrar son otra decisión y merecen su propia discusión —los chats secretos
 * (F9) existen justamente para que ni el server los vea—.
 */
const CLAVE = 'lilachat.chats';

export async function leerChatsGuardados(): Promise<ChatSummary[] | null> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE);
    if (!crudo) return null;
    const datos = JSON.parse(crudo);
    return Array.isArray(datos) ? (datos as ChatSummary[]) : null;
  } catch {
    return null;
  }
}

export async function guardarChats(chats: ChatSummary[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE, JSON.stringify(chats.slice(0, MAX_CHATS_EN_CACHE)));
  } catch {
    // Deliberado: no poder guardar la caché no puede romper nada.
  }
}

/** Al cerrar sesión se borra: la lista de con quién habla alguien no se hereda. */
export async function olvidarChats(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLAVE);
  } catch {
    // Igual que arriba.
  }
}

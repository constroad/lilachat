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

/**
 * La misma lista, en memoria del proceso: quien monte la pantalla de chats la
 * pinta en el PRIMER render, sin esperar a AsyncStorage. Sin esto, remontar la
 * lista mostraba el esqueleto un instante aunque los chats ya estuvieran
 * leídos (José, 17/10/2026).
 */
let enMemoria: ChatSummary[] | null = null;

/** Lo último leído o guardado en este proceso; `null` si todavía nada. */
export function chatsEnMemoria(): ChatSummary[] | null {
  return enMemoria;
}

export async function leerChatsGuardados(): Promise<ChatSummary[] | null> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE);
    if (!crudo) return null;
    const datos = JSON.parse(crudo);
    if (!Array.isArray(datos)) return null;
    enMemoria = datos as ChatSummary[];
    return enMemoria;
  } catch {
    return null;
  }
}

/** Cuánto se espera para escribir: una ráfaga de mensajes es UNA escritura. */
const ESPERA_PARA_ESCRIBIR_MS = 1500;
let escrituraPendiente: ReturnType<typeof setTimeout> | null = null;

/**
 * La memoria se actualiza YA; el disco, juntando ráfagas (FL12, §49 #12). Se
 * llamaba por cada mensaje que llegaba, y cada vez era serializar 50 chats y
 * escribirlos en AsyncStorage, en el hilo JS y con un chat abierto encima.
 */
/** Quien mira un chat abierto se entera de sus acuses en vivo (auditoría 19/10). */
const oyentes = new Set<() => void>();

export function suscribirChatsEnMemoria(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export async function guardarChats(chats: ChatSummary[]): Promise<void> {
  enMemoria = chats;
  oyentes.forEach((oyente) => oyente());
  if (escrituraPendiente) clearTimeout(escrituraPendiente);
  escrituraPendiente = setTimeout(() => {
    escrituraPendiente = null;
    void escribirChats(enMemoria);
  }, ESPERA_PARA_ESCRIBIR_MS);
}

async function escribirChats(chats: ChatSummary[] | null): Promise<void> {
  if (!chats) return;
  try {
    await AsyncStorage.setItem(CLAVE, JSON.stringify(chats.slice(0, MAX_CHATS_EN_CACHE)));
  } catch {
    // Deliberado: no poder guardar la caché no puede romper nada.
  }
}

/** Al cerrar sesión se borra: la lista de con quién habla alguien no se hereda. */
export async function olvidarChats(): Promise<void> {
  enMemoria = null;
  // Una escritura en espera no puede revivir la lista de quien ya salió.
  if (escrituraPendiente) clearTimeout(escrituraPendiente);
  escrituraPendiente = null;
  try {
    await AsyncStorage.removeItem(CLAVE);
  } catch {
    // Igual que arriba.
  }
}

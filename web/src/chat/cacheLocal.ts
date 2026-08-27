import { MAX_CHATS_EN_CACHE } from '@lilachat/shared';
import type { ChatMessage, ChatSummary } from './types';

/**
 * Lo último conocido, en el navegador.
 *
 * Abrir la pestaña mostraba esqueletos y esperaba a la red, igual que la app
 * antes de ser local-first. Acá se guarda para pintar al instante y dejar que la
 * red confirme por detrás.
 *
 * **Sin cifrar, y es una diferencia con la app que hay que decir.** En el
 * teléfono la clave vive en el llavero del sistema; en un navegador no existe
 * ese lugar —cualquier clave en `localStorage` está al lado de lo que protege—.
 * Por eso acá se guarda solo la LISTA y los mensajes de los chats **no
 * secretos**: un chat cifrado no se cachea nunca.
 *
 * **Nunca lanza.** Perder la caché cuesta esperar una vez; romper el arranque
 * por un JSON viejo sería mucho peor.
 */
const CLAVE_CHATS = 'lilachat.chats';
const PREFIJO_MENSAJES = 'lilachat.msgs.';

/** Lo que entra en la primera pantalla y algo más. El resto se pide a la red. */
const MAX_MENSAJES = 60;

function leer<T>(clave: string): T | null {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Cuota llena o modo privado: no poder guardar no rompe nada.
  }
}

export const leerChatsGuardados = (): ChatSummary[] | null => {
  const datos = leer<ChatSummary[]>(CLAVE_CHATS);
  return Array.isArray(datos) ? datos : null;
};

export const guardarChats = (chats: ChatSummary[]): void =>
  escribir(CLAVE_CHATS, chats.slice(0, MAX_CHATS_EN_CACHE));

export const leerMensajesGuardados = (chatId: string): ChatMessage[] | null => {
  const datos = leer<ChatMessage[]>(`${PREFIJO_MENSAJES}${chatId}`);
  return Array.isArray(datos) ? datos : null;
};

export function guardarMensajes(chatId: string, mensajes: ChatMessage[]): void {
  // Un mensaje cifrado NO se cachea: sin llavero donde poner la clave, guardarlo
  // en claro sería deshacer justo lo que el chat secreto promete.
  if (mensajes.some((mensaje) => 'envelope' in mensaje && mensaje.envelope)) return;
  escribir(`${PREFIJO_MENSAJES}${chatId}`, mensajes.slice(-MAX_MENSAJES));
}

/** Al cerrar sesión se borra todo: el historial no se hereda en un navegador. */
export function olvidarCache(): void {
  try {
    const claves = Object.keys(localStorage).filter(
      (clave) => clave === CLAVE_CHATS || clave.startsWith(PREFIJO_MENSAJES)
    );
    claves.forEach((clave) => localStorage.removeItem(clave));
  } catch {
    // Igual que arriba.
  }
}

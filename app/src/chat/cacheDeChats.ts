import type { ChatSummary } from '../api/client';

/**
 * Qué lista de chats se pinta: la guardada o la del server.
 *
 * Existe para que abrir la app muestre algo AL INSTANTE en vez de esqueletos.
 * La app no guardaba nada: cada apertura empezaba en blanco y esperaba a la red,
 * que es la diferencia de fondo con WhatsApp — el render ya estaba virtualizado,
 * lo que faltaba era no tener que esperar.
 *
 * **Cuando el server contesta, manda el server.** No se fusiona: si se
 * fusionara, un chat borrado desde otro teléfono no desaparecería nunca de este.
 * La caché es lo que se ve MIENTRAS, no una segunda fuente de verdad.
 */

/** Tope de la caché: leer un archivo enorme en cada arranque es el problema opuesto. */
export const MAX_CHATS_EN_CACHE = 50;

export function conciliarCache(params: {
  guardado: ChatSummary[] | null;
  /** `null` = el server todavía no contestó. `[]` = contestó que no hay ninguno. */
  delServer: ChatSummary[] | null;
}): ChatSummary[] | null {
  if (params.delServer === null) return params.guardado;
  return params.delServer.slice(0, MAX_CHATS_EN_CACHE);
}

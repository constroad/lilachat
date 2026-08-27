import { decryptMessage, encryptMessage, type Envelope } from './e2ee.js';

/**
 * La caché de mensajes del teléfono, **cifrada en reposo**.
 *
 * La app es local-first: abrir un chat pinta lo guardado al instante en vez de
 * esperar al socket. Guardar los cuerpos en claro sería regalarle el historial
 * de la familia a cualquier app con permiso de archivos, y contradiría de frente
 * a los chats secretos, que existen para que ni el server los lea.
 *
 * Reusa el MISMO `encryptMessage` de F9 (AES-GCM con `@noble`): un segundo
 * mecanismo de cifrado es un segundo lugar donde equivocarse.
 *
 * **La clave vive en `expo-secure-store`**, no acá: este módulo es puro y no
 * sabe de dónde sale. Así se puede probar sin teléfono.
 */

/**
 * Cuántos mensajes se guardan por chat.
 *
 * Es lo que entra en la primera pantalla y algo más: guardar la conversación
 * entera obliga a descifrar un archivo enorme en cada apertura, que es el
 * problema opuesto al que esto resuelve. El resto se pide por `beforeSeq`.
 */
export const MAX_MENSAJES_EN_CACHE = 60;

export function recortarParaCache<T>(mensajes: T[]): T[] {
  // Los ÚLTIMOS: son los que se leen al abrir. Guardar los primeros dejaría la
  // pantalla llena de mensajes viejos mientras llegan los nuevos.
  return mensajes.slice(-MAX_MENSAJES_EN_CACHE);
}

export function cerrarCache(clave: Uint8Array, mensajes: unknown): Envelope {
  return encryptMessage(clave, JSON.stringify(mensajes));
}

/**
 * Devuelve `null` ante CUALQUIER problema —clave distinta, archivo corrupto,
 * formato de una versión vieja—. La caché es una comodidad: perderla cuesta
 * esperar a la red una vez, y hacerla lanzar convertiría eso en una app que no
 * abre.
 */
export function abrirCache<T>(clave: Uint8Array, guardado: Envelope | null): T | null {
  if (!guardado) return null;
  try {
    return JSON.parse(decryptMessage(clave, guardado)) as T;
  } catch {
    return null;
  }
}

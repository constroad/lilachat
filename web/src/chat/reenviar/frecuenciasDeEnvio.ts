import { sumarEnvio, type Frecuencias } from '@lilachat/shared';

/**
 * A dónde mando más (20/10): de acá salen los «Chats frecuentes» al reenviar.
 * Vive en este navegador —es un orden, no un dato secreto— y se anota en cada
 * envío. Lo viejo pesa menos (`sumarEnvio`).
 */
const CLAVE = 'lilachat-frecuencias-de-envio';

export function leerFrecuencias(): Frecuencias {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Frecuencias;
  } catch {
    return {};
  }
}

export function anotarEnvio(chatId: string): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sumarEnvio(leerFrecuencias(), chatId, Date.now())));
  } catch {
    // Sin almacenamiento (pestaña privada): los frecuentes se arman con los próximos envíos.
  }
}

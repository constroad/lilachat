/**
 * Un aviso por chat, como WhatsApp (FL11, José 18/10: «te crea uno por mensaje
 * y no los agrupa»). PURO. El aviso local de la app (la que recibe por el
 * socket) usa el mismo identificador para todo el chat: el nuevo reemplaza al
 * anterior y muestra las últimas líneas.
 */

/** Cuántas líneas muestra el aviso de un chat. */
export const MAXIMO_DE_LINEAS_POR_CHAT = 5;

export const idDeAvisoDeChat = (chatId: string): string => `chat-${chatId}`;

export function sumarLineaAlAviso(lineas: readonly string[], nueva: string): string[] {
  return [...lineas, nueva].slice(-MAXIMO_DE_LINEAS_POR_CHAT);
}

export function cuerpoDelAviso(lineas: readonly string[]): string {
  return lineas.join('\n');
}

export function tituloDelAviso(titulo: string, cuantos: number): string {
  return cuantos > 1 ? `${titulo} · ${cuantos} mensajes` : titulo;
}

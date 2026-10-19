/**
 * El texto del mensaje que publica en su chat una encuesta o un evento creados
 * desde ahí (José, 18/10: «Wilson nunca se enteró»). PURO.
 *
 * Es lo que se lee en la notificación y en la vista previa de la lista de
 * chats; dentro de la conversación el mensaje se dibuja como tarjeta, con la
 * encuesta para votar o el evento para confirmar.
 */
export function textoDeEncuestaEnElChat(pregunta: string): string {
  return `Encuesta: ${pregunta.trim()}`;
}

export function textoDeEventoEnElChat(titulo: string): string {
  return `Evento: ${titulo.trim()}`;
}

/** A qué apunta un mensaje de encuesta o de evento. */
export type RefDeMensaje = { tipo: 'encuesta' | 'evento'; id: string };

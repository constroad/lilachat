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

/** Un recordatorio del grupo (José, 19/10): vive en el chat y le suena a todos. */
export function textoDeRecordatorioEnElChat(titulo: string): string {
  return `Recordatorio: ${titulo.trim()}`;
}

/** A qué apunta un mensaje de encuesta, de evento o de recordatorio del grupo. */
export type RefDeMensaje = { tipo: 'encuesta' | 'evento' | 'recordatorio'; id: string };

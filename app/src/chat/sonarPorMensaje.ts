/**
 * ¿Suena el aviso por este mensaje entrante? Motor PURO.
 *
 * Reglas de WhatsApp, y las dos que importan:
 * - **Lo mío no suena**: lo acabo de escribir.
 * - **El chat que estoy MIRANDO tampoco**: el mensaje ya aparece en pantalla,
 *   un tono encima es ruido (José, 31/08/2026).
 *
 * Cualquier otro mensaje sí suena, esté donde esté la app — que es la paridad
 * con WhatsApp que faltaba: antes el tono solo salía en la lista de chats.
 */
export function sonarPorMensaje(params: {
  senderId: string;
  chatId: string;
  /** El userId propio. */
  yo: string;
  /** El chat abierto en pantalla, o `null` si se está en la lista. */
  chatAbierto: string | null;
}): boolean {
  if (params.senderId === params.yo) return false;
  if (params.chatAbierto !== null && params.chatId === params.chatAbierto) return false;
  return true;
}

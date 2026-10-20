import type { ServerMessage } from './socketClient';

/**
 * El mensaje confirmado que trae la respuesta de una subida (auditoría 19/10).
 * Con esto la burbuja pasa de «subiendo» a «enviado» sin esperar el `msg.new`:
 * con el socket caído, la foto desaparecía unos segundos. Un server viejo no lo
 * manda (o lo manda sin URLs absolutas): entonces nada, y llega por el socket.
 */
export function mensajeSubido(payload: Record<string, unknown>): ServerMessage | undefined {
  const mensaje = payload.message as Partial<ServerMessage> | undefined;
  if (!mensaje || typeof mensaje !== 'object') return undefined;
  const completo =
    typeof mensaje.chatId === 'string' &&
    typeof mensaje.seq === 'number' &&
    typeof mensaje.clientKey === 'string' &&
    typeof mensaje.senderId === 'string' &&
    typeof mensaje.kind === 'string';
  return completo ? (mensaje as ServerMessage) : undefined;
}

import type { Types } from 'mongoose';
import type { MessageRef } from '@lilachat/shared';
import { sendMessage } from './chatService.js';
import { publicarMensaje } from './socket.js';

/**
 * Publica en su chat una encuesta o un evento recién creados (José, 18/10:
 * «la encuesta nunca se envió al chat como lo hace WhatsApp; Wilson nunca se
 * enteró»). Es un mensaje más: toma su `seq`, llega por el socket y con push a
 * quien no está conectado, y la app lo dibuja como tarjeta.
 *
 * El `clientKey` sale del id: si el pedido se reintenta, el mensaje no se
 * duplica (el duplicado ya se repartió cuando se creó).
 */
const KIND_DE_TARJETA = { encuesta: 'poll', evento: 'event', recordatorio: 'reminder', checklist: 'checklist' } as const;

export async function publicarEnElChat(params: {
  chatId: string;
  autor: Types.ObjectId;
  ref: MessageRef;
  texto: string;
}): Promise<void> {
  const resultado = await sendMessage({
    chatId: params.chatId,
    senderId: params.autor,
    clientKey: `${params.ref.tipo}-${params.ref.id}`,
    kind: KIND_DE_TARJETA[params.ref.tipo],
    body: params.texto,
    ref: params.ref,
  });
  if (!resultado.duplicate) await publicarMensaje(resultado.message, resultado.members);
}

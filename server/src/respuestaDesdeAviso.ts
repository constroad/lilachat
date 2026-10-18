import { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { ForbiddenChatError, markRead, sendMessage } from './chatService.js';
import { repartirAcuse } from './entregaPorAviso.js';
import { publicarMensaje } from './socket.js';
import { verificarRespuesta } from './tokenDeRespuesta.js';

export { firmarRespuesta, verificarRespuesta } from './tokenDeRespuesta.js';

/** Lo mismo que admite un mensaje por el socket. */
const LARGO_MAXIMO = 4000;

export type ResultadoDeRespuesta = 'enviada' | 'token' | 'invalida' | 'prohibida';

/** Manda la respuesta como un mensaje más: idempotente por `clientKey`, con su aviso a los demás. */
export async function responderDesdeAviso(params: { token: unknown; texto: unknown; clientKey: unknown }): Promise<ResultadoDeRespuesta> {
  const quien = verificarRespuesta(params.token);
  if (!quien) return 'token';
  const texto = typeof params.texto === 'string' ? params.texto.trim() : '';
  const clientKey = typeof params.clientKey === 'string' ? params.clientKey : '';
  if (!texto || texto.length > LARGO_MAXIMO || clientKey.length < 8 || clientKey.length > 80) return 'invalida';
  try {
    const resultado = await sendMessage({ chatId: quien.chatId, senderId: new Types.ObjectId(quien.userId), clientKey, kind: 'text', body: texto });
    // Publicarlo también marca leído lo propio: responder es haber leído el chat.
    if (!resultado.duplicate) await publicarMensaje(resultado.message, resultado.members);
    return 'enviada';
  } catch (error) {
    if (error instanceof ForbiddenChatError) return 'prohibida';
    throw error;
  }
}

/** Lee el chat hasta su último mensaje y avisa a los demás (el check azul). */
export async function leidoDesdeAviso(token: unknown): Promise<boolean> {
  const quien = verificarRespuesta(token);
  if (!quien) return false;
  const chat = await ChatModel.findById(quien.chatId).select('lastSeq').lean();
  if (!chat) return false;
  try {
    await markRead({ chatId: quien.chatId, userId: new Types.ObjectId(quien.userId), seq: chat.lastSeq });
  } catch {
    // Ya no es del chat: no hay qué leer.
    return false;
  }
  await repartirAcuse(quien.chatId, { chatId: quien.chatId, userId: quien.userId, readSeq: chat.lastSeq, deliveredSeq: chat.lastSeq });
  return true;
}

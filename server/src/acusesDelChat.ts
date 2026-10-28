import { Types } from 'mongoose';
import { ChatModel, MessageModel, ReceiptModel, type Message } from './chatModels.js';
import { ForbiddenChatError } from './erroresDelChat.js';

/**
 * Los acuses de un chat: leído, entregado y lo propio (salieron de
 * `chatService` el 20/10; el servicio los re-exporta). Son CURSORES, no un
 * registro por mensaje: `readSeq`/`deliveredSeq` por miembro, que solo avanzan.
 */
const toObjectId = (value: string | Types.ObjectId): Types.ObjectId | null => {
  if (value instanceof Types.ObjectId) return value;
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
};

/**
 * Lo que mando yo queda leído por mí, en todos mis dispositivos (como
 * WhatsApp). Sin esto un mensaje propio enviado desde el teléfono contaba como
 * «sin leer» en la web y en el otro teléfono. Sin chequeo de membresía: quien
 * llama acaba de crear el mensaje en ese chat. Devuelve el `readSeq` que había
 * (para avisar si avanzó sobre lo ajeno), o `null` si no se marcó.
 */
export async function marcarPropioLeido(
  message: Pick<Message, 'chatId' | 'senderId' | 'seq'>,
  opciones: { soloSiAlDia?: boolean } = {}
): Promise<number | null> {
  const cursor = { $max: { readSeq: message.seq, deliveredSeq: message.seq } };
  const proyeccion = { projection: { readSeq: 1 }, new: false } as const;
  // Lo que sale SIN que el autor esté mirando —un programado, la auto-respuesta,
  // una línea de sistema— no da por leído lo ajeno (auditoría 19/10): solo se
  // marca si ya estaba al día. Sin `upsert`: el filtro por `readSeq` crearía
  // un acuse duplicado.
  const anterior = opciones.soloSiAlDia
    ? await ReceiptModel.findOneAndUpdate({ chatId: message.chatId, userId: message.senderId, readSeq: { $gte: message.seq - 1 } }, cursor, proyeccion).lean()
    : await ReceiptModel.findOneAndUpdate({ chatId: message.chatId, userId: message.senderId }, cursor, { ...proyeccion, upsert: true }).lean();
  if (opciones.soloSiAlDia && !anterior) return null;
  return anterior?.readSeq ?? 0;
}

/**
 * Marca leído hasta `seq`. **Nunca retrocede** (`$max`): dos dispositivos del
 * mismo usuario mandan acuses desordenados, y el que llega tarde no puede
 * resucitar mensajes ya leídos.
 */
/**
 * Mueve el cursor y devuelve si AVANZÓ (FL12, §49 #3): quien re-difunde el
 * acuse no avisa nada cuando no se movió — cada aviso es un re-render en cada
 * teléfono. Se compara contra el documento ANTERIOR (mismo viaje): con
 * `timestamps`, `modifiedCount` da 1 siempre porque `updatedAt` cambia.
 */
/**
 * El chat de un miembro y su último `seq`. Un acuse nunca pasa de ahí: un
 * `readSeq` adelantado hacía nacer leídos los mensajes que todavía no existían
 * (E2E de W3a, 19/10: un recibo con 99 en un grupo con un mensaje).
 */
async function ultimoSeqDelMiembro(chatId: string, userId: Types.ObjectId): Promise<{ id: Types.ObjectId; lastSeq: number }> {
  const id = toObjectId(chatId);
  if (!id) throw new ForbiddenChatError();
  const chat = await ChatModel.findOne({ _id: id, 'members.userId': userId }).select('lastSeq').lean();
  if (!chat) throw new ForbiddenChatError();
  return { id, lastSeq: chat.lastSeq ?? 0 };
}

async function moverCursor(
  filtro: { chatId: Types.ObjectId; userId: Types.ObjectId },
  campos: ('readSeq' | 'deliveredSeq')[],
  seq: number
): Promise<boolean> {
  const anterior = await ReceiptModel.findOneAndUpdate(
    filtro,
    { $max: Object.fromEntries(campos.map((campo) => [campo, seq])) },
    { upsert: true, new: false, projection: { readSeq: 1, deliveredSeq: 1 } }
  ).lean();
  return !anterior || campos.some((campo) => (anterior[campo] ?? 0) < seq);
}

/**
 * Up to `lastSeq` when everything after `seq` is a thread reply the main chat
 * hides (pending 108, José 28/10: groups and channels stayed unread after
 * reading them). A reply takes the chat's next `seq`, but a client can only
 * acknowledge the last message it SHOWS, so the cursor stopped short and the
 * next list reload brought the count back. A reply also sent to the chat
 * (`enElChat`) is visible and is not skipped.
 */
async function throughHiddenReplies(chatId: Types.ObjectId, seq: number, lastSeq: number): Promise<number> {
  if (seq <= 0 || seq >= lastSeq) return seq;
  const visibleAfter = await MessageModel.exists({ chatId, seq: { $gt: seq, $lte: lastSeq }, $or: [{ hiloDe: null }, { enElChat: true }] });
  return visibleAfter ? seq : lastSeq;
}

export async function markRead(params: { chatId: string; userId: Types.ObjectId; seq: number }): Promise<number | false> {
  return (await marcarLeidoDetallado(params)).leido;
}

/**
 * `markRead` con lo que cambió: el `seq` que avanzó (o `false`) y si quitó la
 * marca de «no leído» (auditoría 19/10: sin nada nuevo que leer no salía
 * ningún aviso y mis otros equipos seguían con el punto).
 */
export async function marcarLeidoDetallado(params: { chatId: string; userId: Types.ObjectId; seq: number }): Promise<{ leido: number | false; desmarcado: boolean }> {
  const { id: chatId, lastSeq } = await ultimoSeqDelMiembro(params.chatId, params.userId);
  const seq = await throughHiddenReplies(chatId, Math.min(params.seq, lastSeq), lastSeq);
  if (seq <= 0) return { leido: false, desmarcado: false };
  const [avanzo, marca] = await Promise.all([
    // Leer implica entregado: no se puede leer lo que no llego.
    moverCursor({ chatId, userId: params.userId }, ['readSeq', 'deliveredSeq'], seq),
    // Abrir el chat quita la marca de «no leído» (FL9), como WhatsApp. El
    // filtro solo encuentra la fila si estaba marcada: no escribe de más.
    ChatModel.updateOne(
      { _id: chatId, members: { $elemMatch: { userId: params.userId, markedUnread: true } } },
      { $set: { 'members.$.markedUnread': false } }
    ),
  ]);
  // El seq que de verdad quedó (recortado): es el que se difunde a los demás.
  return { leido: avanzo ? seq : false, desmarcado: marca.modifiedCount > 0 };
}

/**
 * Marcar ENTREGADO —el mensaje llego al telefono— SIN marcarlo leido.
 *
 * Es lo que le faltaba a los checks: sin un acuse de entrega separado, un
 * mensaje saltaba de un check (enviado) a doble check azul (leido) sin pasar por
 * el doble check gris de WhatsApp. `$max` sobre `deliveredSeq` solamente; jamas
 * toca `readSeq`, porque que algo llegue no significa que se haya abierto.
 */
export async function markDelivered(params: {
  chatId: string;
  userId: Types.ObjectId;
  seq: number;
}): Promise<number | false> {
  const { id: chatId, lastSeq } = await ultimoSeqDelMiembro(params.chatId, params.userId);
  const seq = await throughHiddenReplies(chatId, Math.min(params.seq, lastSeq), lastSeq);
  if (seq <= 0) return false;
  return (await moverCursor({ chatId, userId: params.userId }, ['deliveredSeq'], seq)) ? seq : false;
}

/**
 * Al CONECTAR, lo que me llegó mientras estaba desconectado queda entregado
 * (auditoría 19/10): sin push —o con el push perdido— quedaba en un check
 * hasta abrir ese chat. Solo los chats atrasados, en un viaje; devuelve a
 * quién avisar. Nunca toca `readSeq`.
 */
export async function entregarAlConectar(userId: Types.ObjectId): Promise<{ chatId: string; seq: number; miembros: string[] }[]> {
  const chats = await ChatModel.find({ 'members.userId': userId, lastSeq: { $gt: 0 } }).select('lastSeq members.userId').lean<{ _id: Types.ObjectId; lastSeq: number; members: { userId: Types.ObjectId }[] }[]>();
  if (chats.length === 0) return [];
  const acuses = await ReceiptModel.find({ userId, chatId: { $in: chats.map((chat) => chat._id) } }).select('chatId deliveredSeq').lean();
  const entregado = new Map(acuses.map((acuse) => [String(acuse.chatId), acuse.deliveredSeq ?? 0]));
  const atrasados = chats.filter((chat) => chat.lastSeq > (entregado.get(String(chat._id)) ?? 0));
  if (atrasados.length === 0) return [];
  await ReceiptModel.bulkWrite(
    atrasados.map((chat) => ({ updateOne: { filter: { chatId: chat._id, userId }, update: { $max: { deliveredSeq: chat.lastSeq } }, upsert: true } }))
  );
  return atrasados.map((chat) => ({ chatId: String(chat._id), seq: chat.lastSeq, miembros: chat.members.map((miembro) => String(miembro.userId)) }));
}

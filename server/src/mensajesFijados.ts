import { Types } from 'mongoose';
import { actsAsMessage, agregarFijado, fijadosVigentes, puedeFijarEnElChat, venceDelFijado } from '@lilachat/shared';
import { ChatModel, MessageModel, type Chat } from './chatModels.js';

/**
 * Fijar mensajes arriba del chat (19/10). El permiso y los plazos los decide
 * el motor compartido (`shared/mensajesFijados.ts`); acá se comprueban contra
 * la base: un cliente modificado se saltea la app.
 */
type Resultado = { ok: true; miembros: string[]; encrypted: boolean } | { ok: false; status: 400 | 403 | 404; motivo: string };
type FijadoGuardado = NonNullable<Chat['fijados']>[number];

/** La vista previa que viaja con la lista: el texto (nunca el de un chat secreto) o el tipo de adjunto. */
export type FijadoEnLista = {
  seq: number;
  por: string;
  en: string;
  hasta: string;
  vista: { senderId: string; kind: string; body?: string; mime?: string };
};
const LARGO_DE_LA_VISTA = 140;

async function chatDelMiembro(chatId: string, quien: Types.ObjectId) {
  if (!Types.ObjectId.isValid(chatId)) return null;
  return ChatModel.findOne({ _id: chatId, 'members.userId': quien }).lean();
}

const aGuardado = (uno: { seq: number; por: string; en: string; hasta: string }): FijadoGuardado => ({
  seq: uno.seq,
  por: new Types.ObjectId(uno.por),
  en: new Date(uno.en),
  hasta: new Date(uno.hasta),
});
const aMotor = (uno: FijadoGuardado) => ({ seq: uno.seq, por: String(uno.por), en: uno.en.toISOString(), hasta: uno.hasta.toISOString() });

async function permiso(chatId: string, quien: Types.ObjectId): Promise<{ ok: true; chat: Chat } | { ok: false; status: 403; motivo: string }> {
  const chat = (await chatDelMiembro(chatId, quien)) as Chat | null;
  if (!chat) return { ok: false, status: 403, motivo: 'No estás en esa conversación.' };
  const yo = chat.members.find((miembro) => String(miembro.userId) === String(quien));
  if (!puedeFijarEnElChat({ kind: chat.kind, esAdmin: yo?.role === 'admin' })) {
    return { ok: false, status: 403, motivo: 'En un grupo, solo los admins fijan mensajes.' };
  }
  return { ok: true, chat };
}

export async function fijarMensaje(params: { chatId: string; quien: Types.ObjectId; seq: number; duracion: string }): Promise<Resultado> {
  const ahora = Date.now();
  const hasta = venceDelFijado(params.duracion, ahora);
  if (!hasta || !Number.isInteger(params.seq)) return { ok: false, status: 400, motivo: 'Elige 24 horas, 7 días, 30 días o sin vencimiento.' };
  const decision = await permiso(params.chatId, params.quien);
  if (!decision.ok) return decision;
  const target = await MessageModel.findOne({ chatId: decision.chat._id, seq: params.seq }).select('deletedAt kind system').lean();
  if (!target) return { ok: false, status: 404, motivo: 'No encontramos ese mensaje.' };
  if (target.deletedAt || !actsAsMessage(target)) return { ok: false, status: 400, motivo: 'Ese mensaje no se puede fijar.' };

  const nuevo = { seq: params.seq, por: String(params.quien), en: new Date(ahora).toISOString(), hasta };
  const lista = agregarFijado((decision.chat.fijados ?? []).map(aMotor), nuevo, ahora);
  await ChatModel.updateOne({ _id: decision.chat._id }, { $set: { fijados: lista.map(aGuardado) } });
  return { ok: true, miembros: decision.chat.members.map((miembro) => String(miembro.userId)), encrypted: decision.chat.encrypted === true };
}

export async function desfijarMensaje(params: { chatId: string; quien: Types.ObjectId; seq: number }): Promise<Resultado> {
  const decision = await permiso(params.chatId, params.quien);
  if (!decision.ok) return decision;
  await ChatModel.updateOne({ _id: decision.chat._id }, { $pull: { fijados: { seq: params.seq } } });
  return { ok: true, miembros: decision.chat.members.map((miembro) => String(miembro.userId)), encrypted: decision.chat.encrypted === true };
}

/**
 * Los fijados vigentes de cada chat de la lista, con su vista previa. Una sola
 * consulta de mensajes para todos (casi ningún chat tiene fijados). Lo que la
 * persona borró para sí (`borradoHasta`) no le aparece.
 */
export async function fijadosParaLaLista(
  chats: readonly Pick<Chat, '_id' | 'fijados' | 'encrypted' | 'members'>[],
  userId: Types.ObjectId
): Promise<Map<string, FijadoEnLista[]>> {
  const ahora = Date.now();
  const porChat = new Map<string, ReturnType<typeof aMotor>[]>();
  for (const chat of chats) {
    const yo = chat.members.find((miembro) => String(miembro.userId) === String(userId));
    const vigentes = fijadosVigentes((chat.fijados ?? []).map(aMotor), ahora).filter((uno) => uno.seq > (yo?.borradoHasta ?? 0));
    if (vigentes.length) porChat.set(String(chat._id), vigentes);
  }
  const resultado = new Map<string, FijadoEnLista[]>();
  if (porChat.size === 0) return resultado;
  const mensajes = await MessageModel.find({ $or: [...porChat].map(([chatId, lista]) => ({ chatId: new Types.ObjectId(chatId), seq: { $in: lista.map((uno) => uno.seq) } })) })
    .select('chatId seq senderId kind body media.mime deletedAt')
    .lean();
  const secretos = new Set(chats.filter((chat) => chat.encrypted).map((chat) => String(chat._id)));
  const mensajePorClave = new Map(mensajes.map((uno) => [`${String(uno.chatId)}:${uno.seq}`, uno]));
  for (const [chatId, lista] of porChat) {
    const conVista = lista.flatMap((uno) => {
      const mensaje = mensajePorClave.get(`${chatId}:${uno.seq}`);
      if (!mensaje || mensaje.deletedAt) return [];
      const body = secretos.has(chatId) ? undefined : mensaje.body?.slice(0, LARGO_DE_LA_VISTA);
      return [{ ...uno, vista: { senderId: String(mensaje.senderId), kind: mensaje.kind, ...(body ? { body } : {}), ...(mensaje.media?.mime ? { mime: mensaje.media.mime } : {}) } }];
    });
    if (conVista.length) resultado.set(chatId, conVista);
  }
  return resultado;
}

import { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';

/**
 * De los ids pedidos, los que son contactos míos: comparten algún chat
 * conmigo (FL10). Con un id inválido o un desconocido, no vuelve.
 */
export async function contactosDe(yo: Types.ObjectId, pedidos: readonly string[]): Promise<Types.ObjectId[]> {
  const validos = [...new Set(pedidos)].filter((id) => Types.ObjectId.isValid(id) && id !== String(yo)).map((id) => new Types.ObjectId(id));
  if (validos.length === 0) return [];
  const chats = await ChatModel.find({ 'members.userId': { $all: [yo], $in: validos } }).select('members.userId').lean();
  const conocidos = new Set(chats.flatMap((chat) => chat.members.map((m) => String(m.userId))));
  return validos.filter((id) => conocidos.has(String(id)));
}

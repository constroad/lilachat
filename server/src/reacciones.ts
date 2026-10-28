import { Types } from 'mongoose';
import { esEmojiDeReaccion } from '@lilachat/shared';
import { customEmojiNameFromToken } from '@lilachat/shared';
import { hasCustomEmoji } from './customEmojiCatalog.js';
import { ACTS_AS_MESSAGE_FILTER, ChatModel, MessageModel, type Message } from './chatModels.js';

export type ReaccionGuardada = { userId: string; emoji: string; en: Date };
export type ResultadoDeReaccion =
  | { ok: true; chatId: string; seq: number; reacciones: ReaccionGuardada[]; autor: string; cuerpo?: string }
  | { ok: false; status: 400 | 403 | 404; motivo: string };

const NO_ESTA = { ok: false, status: 404, motivo: 'Ese mensaje ya no está.' } as const;
const NO_ADMITE = { ok: false, status: 400, motivo: 'A ese mensaje no se le puede reaccionar.' } as const;

/**
 * Reaccionar (20/10), como WhatsApp: UNA por persona. `emoji` la pone o la
 * cambia; `null` la quita. Atómico —un update pipeline que saca la mía y suma
 * la nueva—, así dos reacciones a la vez no se pisan. Vale en el chat y en los
 * hilos (una respuesta es un mensaje más). No en lo borrado, los avisos ni un
 * chat secreto (el emoji iría en claro).
 */
export async function reaccionar(params: { chatId: string; seq: number; userId: string; emoji: string | null }): Promise<ResultadoDeReaccion> {
  const customName = params.emoji === null ? null : customEmojiNameFromToken(params.emoji);
  if (params.emoji !== null && !customName && !esEmojiDeReaccion(params.emoji)) return { ok: false, status: 400, motivo: 'Esa reacción no es un emoji.' };
  if (!Types.ObjectId.isValid(params.chatId) || !Number.isInteger(params.seq) || params.seq <= 0) return NO_ESTA;
  const chatId = new Types.ObjectId(params.chatId);
  // La membresía primero: sin esto se sondearía si un `seq` existe en un chat ajeno.
  const chat = await ChatModel.findOne({ _id: chatId, 'members.userId': new Types.ObjectId(params.userId) }).select('encrypted workspaceId').lean();
  if (!chat) return { ok: false, status: 403, motivo: 'No eres miembro de este chat.' };
  if (chat.encrypted) return NO_ADMITE;
  // Pending 19: a space's own emoji, only in that space's chats and while it exists.
  if (customName && !(chat.workspaceId && (await hasCustomEmoji(chat.workspaceId, customName)))) return { ok: false, status: 400, motivo: 'Ese emoji no es de este espacio.' };

  const sinLaMia = { $filter: { input: { $ifNull: ['$reacciones', []] }, cond: { $ne: ['$$this.userId', params.userId] } } };
  const nueva = params.emoji ? [{ userId: params.userId, emoji: params.emoji, en: new Date() }] : [];
  const actualizado = await MessageModel.findOneAndUpdate(
    { chatId, seq: params.seq, deletedAt: { $exists: false }, ...ACTS_AS_MESSAGE_FILTER },
    [{ $set: { reacciones: { $concatArrays: [sinLaMia, nueva] } } }],
    { new: true, updatePipeline: true, projection: { reacciones: 1, senderId: 1, body: 1 } }
  ).lean<Pick<Message, 'reacciones' | 'senderId' | 'body'> | null>();
  if (!actualizado) return (await MessageModel.exists({ chatId, seq: params.seq })) ? NO_ADMITE : NO_ESTA;
  return { ok: true, chatId: params.chatId, seq: params.seq, reacciones: actualizado.reacciones ?? [], autor: String(actualizado.senderId), cuerpo: actualizado.body };
}

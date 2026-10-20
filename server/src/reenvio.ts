import { Types } from 'mongoose';
import { ChatModel, MessageModel, type Message } from './chatModels.js';
import { ForbiddenChatError, sendMessage } from './chatService.js';

type ResultadoDeReenvio =
  | { ok: true; message: Message; members?: string[]; duplicate: boolean }
  | { ok: false; status: 400 | 403 | 404; motivo: string };

const NO_EXISTE = { ok: false as const, status: 404 as const, motivo: 'Ese mensaje ya no existe.' };

/**
 * Reenviar una foto o un archivo (auditoría 19/10): se copia la REFERENCIA al
 * archivo —el mismo `mediaId` en el storage— y su pie a otro chat, como
 * mensaje de quien reenvía. Solo desde un chat del que soy miembro, nada
 * borrado ni cifrado; el destino lo valida `sendMessage` (miembro y no
 * secreto). Idempotente por `clientKey`.
 */
export async function reenviarMensaje(params: { quien: Types.ObjectId; desde: string; seq: number; hacia: string; clientKey: string }): Promise<ResultadoDeReenvio> {
  if (!Types.ObjectId.isValid(params.desde) || !Number.isInteger(params.seq) || !params.clientKey) {
    return { ok: false, status: 400, motivo: 'Faltan datos para reenviar.' };
  }
  const desde = new Types.ObjectId(params.desde);
  if (!(await ChatModel.exists({ _id: desde, 'members.userId': params.quien, encrypted: { $ne: true } }))) return NO_EXISTE;
  const original = await MessageModel.findOne({ chatId: desde, seq: params.seq, deletedAt: null }).select('kind body media envelope').lean<Message | null>();
  if (!original || original.envelope || (!original.media && !original.body)) return NO_EXISTE;
  try {
    const result = await sendMessage({ chatId: params.hacia, senderId: params.quien, clientKey: params.clientKey, kind: original.kind, body: original.body, media: original.media });
    return { ok: true, ...result, duplicate: Boolean(result.duplicate) };
  } catch (error) {
    if (error instanceof ForbiddenChatError) return { ok: false, status: 403, motivo: 'No puedes escribir en ese chat.' };
    throw error;
  }
}

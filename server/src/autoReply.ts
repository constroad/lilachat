import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { sendMessage } from './chatService.js';

/**
 * Auto-respuesta / ausente (F11): cuando NO estás (sin socket) y alguien te
 * escribe a un chat 1:1, el server contesta solo con un texto tuyo
 * («estoy manejando, te contesto luego»). Al volver, ves su mensaje y que ya
 * salió tu aviso.
 *
 * **Los tres footguns, y cómo se evitan** (todo en `debeAutoResponder`):
 * 1. **Loop entre dos ausentes.** Si los dos tienen auto-reply, se
 *    responderían para siempre. Un auto-reply lleva `autoReply: true` y NUNCA
 *    dispara otro.
 * 2. **Spam.** Se responde UNA vez por chat cada ventana (2 h): a la décima vez
 *    que te escriben, no manda diez «estoy manejando».
 * 3. **A grupos no.** Un aviso de ausente en un grupo es ruido para todos.
 */
const VENTANA_MS = 2 * 3600 * 1000;

interface AutoReplyState {
  userId: Types.ObjectId;
  chatId: Types.ObjectId;
  at: Date;
}
const stateSchema = new Schema<AutoReplyState>({
  userId: { type: Schema.Types.ObjectId, required: true },
  chatId: { type: Schema.Types.ObjectId, required: true },
  at: { type: Date, required: true },
});
stateSchema.index({ userId: 1, chatId: 1 }, { unique: true });

const AutoReplyStateModel: Model<AutoReplyState> =
  (mongoose.models.AutoReplyState as Model<AutoReplyState>) ??
  mongoose.model<AutoReplyState>('AutoReplyState', stateSchema);

export function debeAutoResponder(params: {
  chatKind: 'direct' | 'group';
  habilitado: boolean;
  /** El mensaje entrante ES un auto-reply: NO se responde (corta el loop). */
  entranteEsAutoReply: boolean;
  /** Cuándo se auto-respondió por última vez a ESTE chat (rate-limit). */
  ultimoAt: Date | null;
  now: Date;
}): boolean {
  if (!params.habilitado) return false;
  if (params.chatKind !== 'direct') return false;
  if (params.entranteEsAutoReply) return false;
  if (params.ultimoAt && params.now.getTime() - params.ultimoAt.getTime() < VENTANA_MS) {
    return false;
  }
  return true;
}

/**
 * Dispara los auto-reply de los destinatarios AUSENTES de un mensaje. La lista
 * de ausentes la decide quien llama (el socket ya sabe quién no tiene socket);
 * acá se aplica la regla y se manda.
 */
export async function autoResponderA(params: {
  message: { chatId: Types.ObjectId; senderId: Types.ObjectId; kind: string; autoReply?: boolean };
  ausentes: string[];
  now?: Date;
}): Promise<number> {
  const now = params.now ?? new Date();
  // Solo texto: no se auto-responde a una foto (ni un auto-reply es una foto).
  if (params.message.kind !== 'text' || params.message.autoReply) return 0;

  const chat = await ChatModel.findById(params.message.chatId).select('kind').lean<{ kind: 'direct' | 'group' } | null>();
  if (!chat || chat.kind !== 'direct') return 0;

  let enviados = 0;
  for (const idStr of params.ausentes) {
    if (idStr === String(params.message.senderId)) continue;
    if (!mongoose.Types.ObjectId.isValid(idStr)) continue;
    const userId = new mongoose.Types.ObjectId(idStr);

    const user = await UserModel.findById(userId).select('autoReply').lean<{ autoReply?: { enabled?: boolean; text?: string } } | null>();
    const habilitado = user?.autoReply?.enabled === true;
    const texto = (user?.autoReply?.text ?? '').trim();
    if (!habilitado || !texto) continue;

    const estado = await AutoReplyStateModel.findOne({ userId, chatId: params.message.chatId }).lean<{ at: Date } | null>();
    if (
      !debeAutoResponder({
        chatKind: 'direct',
        habilitado,
        entranteEsAutoReply: Boolean(params.message.autoReply),
        ultimoAt: estado?.at ?? null,
        now,
      })
    ) {
      continue;
    }

    // Se sella ANTES de enviar (mismo criterio que los crons): si dos mensajes
    // llegan juntos, uno solo dispara el auto-reply.
    const ganado = await AutoReplyStateModel.updateOne(
      { userId, chatId: params.message.chatId },
      { $set: { at: now } },
      { upsert: true }
    ).catch(() => null);
    if (!ganado) continue;

    try {
      await sendMessage({
        chatId: String(params.message.chatId),
        senderId: userId,
        clientKey: `auto-${params.message.chatId}-${now.getTime()}`,
        body: texto,
        autoReply: true,
      });
      enviados += 1;
    } catch {
      // Si no se pudo (lo sacaron del chat), el sello ya está: no reintenta.
    }
  }
  return enviados;
}

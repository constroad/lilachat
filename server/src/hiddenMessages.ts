import { Router } from 'express';
import mongoose, { Schema, Types, type Model } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { emitHiddenForMe } from './reparto.js';

/**
 * «Eliminar para mí» on every device of the person (José, 13/11: with the web
 * open on two computers, what he deleted in one stayed in the other). The
 * phone and each browser still hide locally at once; this keeps the list per
 * person and chat, so another device merges it when it opens the chat and
 * hears new ones by socket. Nobody else learns what was hidden.
 */
const hiddenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    chatId: { type: Schema.Types.ObjectId, required: true },
    seqs: { type: [Number], default: [] },
  },
  { timestamps: true }
);
hiddenSchema.index({ userId: 1, chatId: 1 }, { unique: true });
type HiddenMessages = { userId: Types.ObjectId; chatId: Types.ObjectId; seqs: number[] };
export const HiddenMessagesModel: Model<HiddenMessages> =
  (mongoose.models.HiddenMessages as Model<HiddenMessages> | undefined) ?? mongoose.model<HiddenMessages>('HiddenMessages', hiddenSchema, 'hidden_messages');

/** One request hides at most this many (a whole day picked from «Almacenamiento»). */
export const MAX_SEQS_PER_REQUEST = 500;

export function parseHiddenSeqs(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SEQS_PER_REQUEST) return null;
  return raw.every((seq) => Number.isSafeInteger(seq) && (seq as number) > 0) ? [...new Set(raw as number[])] : null;
}

async function isMember(chatId: string, userId: Types.ObjectId): Promise<boolean> {
  if (!Types.ObjectId.isValid(chatId)) return false;
  return Boolean(await ChatModel.exists({ _id: chatId, 'members.userId': userId }));
}

export async function hiddenSeqsOf(chatId: string, userId: Types.ObjectId): Promise<number[]> {
  const row = await HiddenMessagesModel.findOne({ userId, chatId }).select('seqs').lean<{ seqs?: number[] } | null>();
  return row?.seqs ?? [];
}

export function buildHiddenMessagesRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get(
    '/:chatId/ocultos',
    asyncRoute(async (req, res) => {
      const userId = new Types.ObjectId(req.session!.userId);
      if (!(await isMember(req.params.chatId!, userId))) return res.status(403).json({ message: 'No estás en esa conversación.' });
      return res.status(200).json({ seqs: await hiddenSeqsOf(req.params.chatId!, userId) });
    })
  );

  router.post(
    '/:chatId/ocultos',
    asyncRoute(async (req, res) => {
      const userId = new Types.ObjectId(req.session!.userId);
      const seqs = parseHiddenSeqs(req.body?.seqs);
      if (!seqs) return res.status(400).json({ message: `Manda { seqs: [números] }, entre 1 y ${MAX_SEQS_PER_REQUEST}.` });
      if (!(await isMember(req.params.chatId!, userId))) return res.status(403).json({ message: 'No estás en esa conversación.' });
      await HiddenMessagesModel.updateOne({ userId, chatId: req.params.chatId }, { $addToSet: { seqs: { $each: seqs } } }, { upsert: true });
      emitHiddenForMe(String(userId), req.params.chatId!, seqs);
      return res.status(200).json({ ok: true });
    })
  );

  return router;
}

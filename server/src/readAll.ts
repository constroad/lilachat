import { Router } from 'express';
import { Types } from 'mongoose';
import { ChatModel, ReceiptModel } from './chatModels.js';
import { marcarLeidoDetallado } from './acusesDelChat.js';
import { repartirAcuse } from './entregaPorAviso.js';
import { avisarCambioDeChat } from './reparto.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { allActiveIn } from './workspaceChats.js';

type ChatToRead = { _id: Types.ObjectId; lastSeq?: number; members: { userId: Types.ObjectId; markedUnread?: boolean }[] };

/** Whether this chat has something for me to read: messages past my cursor, or my «no leído» mark. */
function hasUnread(chat: ChatToRead, userId: Types.ObjectId, readSeq: number): boolean {
  const mine = chat.members.find((member) => String(member.userId) === String(userId));
  return (chat.lastSeq ?? 0) > readSeq || mine?.markedUnread === true;
}

/**
 * «Leer todo», like WhatsApp (R31/10-B9): every chat of the list (a space's or
 * the personal ones) read up to its last message, each one as if it had been
 * opened. The others get the same receipt (with «leído» hidden where it is), and
 * my devices reload their list ONCE: a notice per chat was a burst of reloads.
 * Returns how many chats changed.
 */
export async function readAll(userId: Types.ObjectId, workspaceId: Types.ObjectId | null): Promise<number> {
  const chats = await ChatModel.find({ 'members.userId': userId, workspaceId: workspaceId ?? { $exists: false } }).select('_id lastSeq members.userId members.markedUnread').lean<ChatToRead[]>();
  const receipts = await ReceiptModel.find({ userId, chatId: { $in: chats.map((chat) => chat._id) } }).select('chatId readSeq').lean();
  const readOf = new Map(receipts.map((receipt) => [String(receipt.chatId), receipt.readSeq ?? 0]));
  let changed = 0;
  let lastChanged = '';
  for (const chat of chats) {
    const chatId = String(chat._id);
    if (!hasUnread(chat, userId, readOf.get(chatId) ?? 0)) continue;
    const { leido, desmarcado } = await marcarLeidoDetallado({ chatId, userId, seq: chat.lastSeq ?? 0 });
    if (leido) await repartirAcuse(chatId, { chatId, userId: String(userId), readSeq: leido, deliveredSeq: leido });
    if (!leido && !desmarcado) continue;
    changed += 1;
    lastChanged = chatId;
  }
  if (lastChanged) avisarCambioDeChat(String(userId), lastChanged);
  return changed;
}

/** `POST /api/chats/read-all {workspaceId?}`: a space only for an active member of it. */
export function buildReadAllRouter(): Router {
  const router = Router();
  router.post('/read-all', requireSession, asyncRoute(async (req, res) => {
    const userId = new Types.ObjectId(req.session!.userId);
    const raw = req.body?.workspaceId;
    const workspaceId = typeof raw === 'string' && Types.ObjectId.isValid(raw) ? new Types.ObjectId(raw) : null;
    if (raw !== undefined && raw !== null && !workspaceId) return void res.status(400).json({ message: 'Ese espacio no existe.' });
    if (workspaceId && !(await allActiveIn(workspaceId, [userId]))) return void res.status(404).json({ message: 'Ese espacio no existe o no estás en él.' });
    res.json({ ok: true, chats: await readAll(userId, workspaceId) });
  }));
  return router;
}

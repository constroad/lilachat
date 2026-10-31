import { Types } from 'mongoose';
import { disappearSecondsOf, memberMay, memberPermissionDenied, type DisappearKey } from '@lilachat/shared';
import { ChatModel, MessageModel, type Chat } from './chatModels.js';
import { DELETED_CONTENT } from './chatService.js';
import { descontarRespuesta } from './hilos.js';

/**
 * Disappearing messages (R31/10-B6). The chat keeps the timer; `sendMessage`
 * stamps `disappearsAt` on each new message and moves the chat's
 * `nextDisappearAt`. The sweep empties what is due, like «Eliminar para
 * todos», and keeps `disappearsAt` so every device hides the row instead of
 * drawing a tombstone. Devices hide it by the clock even before the sweep.
 */
export type DisappearChange = { ok: true; members: string[]; changed: boolean } | { ok: false; status: 403 | 404 | 409; message: string };

/** How many messages one chat empties per sweep: the rest wait for the next tick. */
const SWEEP_BATCH = 200;
/** How many due chats one sweep visits. */
const SWEEP_CHATS = 50;
const SWEEP_EVERY_MS = 60_000;

/** Who may set it: a member of a 1:1 or a group, with «Editar la info» in a group; never a channel or a secret chat. */
function refusalFor(chat: Chat, userId: Types.ObjectId): DisappearChange | null {
  if (chat.encrypted) return { ok: false, status: 409, message: 'Los chats secretos todavía no tienen mensajes temporales.' };
  if (chat.channel || chat.kind === 'notas') return { ok: false, status: 409, message: 'Los canales guardan su historial: no tienen mensajes temporales.' };
  if (chat.kind !== 'group') return null;
  const role = chat.members.find((member) => String(member.userId) === String(userId))?.role;
  return memberMay({ permission: 'editInfo', role: role === 'admin' ? 'admin' : 'member', permissions: chat.memberPermissions }) ? null : { ok: false, status: 403, message: memberPermissionDenied('editInfo') };
}

/** Turns the timer on, changes it or turns it off. `changed: false` when it already was that. */
export async function setDisappearing(params: { chatId: string; userId: Types.ObjectId; key: DisappearKey }): Promise<DisappearChange> {
  const chat = Types.ObjectId.isValid(params.chatId)
    ? await ChatModel.findOne({ _id: params.chatId, 'members.userId': params.userId }).select('kind encrypted channel members.userId members.role memberPermissions disappearSeconds').lean<Chat | null>()
    : null;
  if (!chat) return { ok: false, status: 404, message: 'Ese chat no existe.' };
  const refusal = refusalFor(chat, params.userId);
  if (refusal) return refusal;
  const members = chat.members.map((member) => String(member.userId));
  const seconds = disappearSecondsOf(params.key);
  if ((chat.disappearSeconds ?? 0) === seconds) return { ok: true, members, changed: false };
  await ChatModel.updateOne({ _id: chat._id }, seconds ? { $set: { disappearSeconds: seconds } } : { $unset: { disappearSeconds: '' } });
  return { ok: true, members, changed: true };
}

/** Empties one chat's due messages and moves its `nextDisappearAt` to the next one, or clears it. */
async function sweepChat(chatId: Types.ObjectId, now: Date): Promise<number> {
  const due = await MessageModel.find({ chatId, disappearsAt: { $lte: now }, deletedAt: { $exists: false } }).select('seq hiloDe').limit(SWEEP_BATCH).lean<{ seq: number; hiloDe?: number }[]>();
  const seqs = due.map((message) => message.seq);
  if (seqs.length) {
    await MessageModel.updateMany({ chatId, seq: { $in: seqs } }, { $set: { deletedAt: now }, $unset: DELETED_CONTENT });
    await ChatModel.updateOne({ _id: chatId }, { $pull: { fijados: { seq: { $in: seqs } } } });
    // One count per reply: a thread loses each reply that disappeared.
    for (const message of due) if (message.hiloDe !== undefined) await descontarRespuesta(chatId, message.hiloDe);
  }
  // A full batch may leave more due: the chat stays due for the next tick.
  if (seqs.length === SWEEP_BATCH) return seqs.length;
  const next = await MessageModel.findOne({ chatId, disappearsAt: { $gt: now }, deletedAt: { $exists: false } }).sort({ disappearsAt: 1 }).select('disappearsAt').lean<{ disappearsAt?: Date } | null>();
  await ChatModel.updateOne({ _id: chatId }, next?.disappearsAt ? { $set: { nextDisappearAt: next.disappearsAt } } : { $unset: { nextDisappearAt: '' } });
  return seqs.length;
}

/** One pass: the chats with something due, each emptied. Returns how many messages went. */
export async function sweepDisappeared(now: Date = new Date()): Promise<number> {
  const chats = await ChatModel.find({ nextDisappearAt: { $lte: now } }).select('_id').limit(SWEEP_CHATS).lean<{ _id: Types.ObjectId }[]>();
  let swept = 0;
  for (const chat of chats) swept += await sweepChat(chat._id, now);
  return swept;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Inside the server, like the reminders: a minute is WhatsApp's own precision. */
export function startDisappearCron(): void {
  if (timer) return;
  const tick = () => void sweepDisappeared().catch((error) => console.error('[cron] mensajes temporales:', error instanceof Error ? error.message : error));
  timer = setInterval(tick, SWEEP_EVERY_MS);
  tick();
}

import { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';

/** A refused nudge: permanent for the client's queue, which drops it with this reason. */
export class NudgeError extends Error {}

/** One nudge every this long per person and chat (spec, backlog 3): more is spam. */
const NUDGE_EVERY_MS = 10_000;
const lastNudge = new Map<string, number>();

/** For the tests. */
export function __resetNudges(): void {
  lastNudge.clear();
}

/**
 * The MSN Messenger nudge (backlog 3): only in a 1:1 for now (in a group it
 * would be spam until an admin setting exists) and once every 10 seconds.
 * Checked BEFORE `sendMessage`, which takes a `seq` that a refusal would waste.
 */
export async function ensureNudgeAllowed(chatId: string, senderId: Types.ObjectId, now: number = Date.now()): Promise<void> {
  const chat = Types.ObjectId.isValid(chatId) ? await ChatModel.findOne({ _id: chatId, 'members.userId': senderId }).select('kind').lean() : null;
  if (!chat) throw new NudgeError('No estás en esa conversación.');
  if (chat.kind !== 'direct') throw new NudgeError('El zumbido es solo para chats de dos personas.');
  const key = `${chatId}:${String(senderId)}`;
  const last = lastNudge.get(key);
  if (last !== undefined && now - last < NUDGE_EVERY_MS) throw new NudgeError('Espera unos segundos para mandar otro zumbido.');
  lastNudge.set(key, now);
}

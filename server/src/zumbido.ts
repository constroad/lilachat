import { Types } from 'mongoose';
import { isWinkId } from '@lilachat/shared';
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

/** A nudge or a wink: what MSN Messenger called fun, and what a group admin can switch off. */
export type FunKind = 'zumbido' | 'guino';

const LIMIT_TEXT: Record<FunKind, string> = {
  zumbido: 'Espera unos segundos para mandar otro zumbido.',
  guino: 'Espera unos segundos para mandar otro guiño.',
};

/**
 * The MSN Messenger nudge and winks (backlog 3, José 21/10): in a 1:1, and in a
 * group only if an admin allowed it (otherwise it is spam); each kind once
 * every 10 seconds per person and chat. Checked BEFORE `sendMessage`, which
 * takes a `seq` that a refusal would waste.
 */
export async function ensureFunAllowed(chatId: string, senderId: Types.ObjectId, kind: FunKind, now: number = Date.now(), wink?: unknown): Promise<void> {
  if (kind === 'guino' && !isWinkId(wink)) throw new NudgeError('Ese guiño no existe.');
  const chat = Types.ObjectId.isValid(chatId) ? await ChatModel.findOne({ _id: chatId, 'members.userId': senderId }).select('kind funAllowed').lean() : null;
  if (!chat) throw new NudgeError('No estás en esa conversación.');
  if (chat.kind === 'notas') throw new NudgeError('Los zumbidos y los guiños son para chatear con otras personas.');
  if (chat.kind === 'group' && chat.funAllowed !== true) throw new NudgeError('En este grupo los admins no permiten zumbidos ni guiños.');
  const key = `${kind}:${chatId}:${String(senderId)}`;
  const last = lastNudge.get(key);
  if (last !== undefined && now - last < NUDGE_EVERY_MS) throw new NudgeError(LIMIT_TEXT[kind]);
  lastNudge.set(key, now);
}

/** A group admin switches nudges and winks on or off for everyone (José, 21/10). */
export async function setGroupFun(params: { chatId: string; who: Types.ObjectId; allowed: boolean }): Promise<{ ok: true; members: string[] } | { ok: false; status: 400 | 403; reason: string }> {
  const chat = Types.ObjectId.isValid(params.chatId) ? await ChatModel.findOne({ _id: params.chatId, 'members.userId': params.who }).select('kind members').lean() : null;
  if (!chat || chat.kind !== 'group') return { ok: false, status: 400, reason: 'Eso solo se cambia en un grupo.' };
  const isAdmin = chat.members.some((member) => String(member.userId) === String(params.who) && member.role === 'admin');
  if (!isAdmin) return { ok: false, status: 403, reason: 'Solo los admins cambian esto.' };
  await ChatModel.updateOne({ _id: chat._id }, params.allowed ? { $set: { funAllowed: true } } : { $unset: { funAllowed: 1 } });
  return { ok: true, members: chat.members.map((member) => String(member.userId)) };
}

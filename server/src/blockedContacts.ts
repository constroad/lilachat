import { Router } from 'express';
import { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { avisarCambioDeChat } from './socket.js';

type Outcome = { ok: true } | { ok: false; status: 400 | 404; reason: string };

/** Everyone on the other side of a block with me, in either direction: no presence crosses it. */
export async function blockedEitherWay(userId: Types.ObjectId | string): Promise<Set<string>> {
  const users = await UserModel.find({ $or: [{ _id: userId }, { blockedUsers: userId }] }).select('_id blockedUsers').lean();
  const ids = new Set<string>();
  for (const user of users) {
    if (String(user._id) === String(userId)) for (const id of user.blockedUsers ?? []) ids.add(String(id));
    else ids.add(String(user._id));
  }
  return ids;
}

/** A call offer in a blocked 1:1 rings nobody (pending 9); the caller just hears it ring out. */
export async function isBlockedChat(chatId: string): Promise<boolean> {
  return Boolean(await ChatModel.exists({ _id: chatId, 'blockedBy.0': { $exists: true } }));
}

/** Who of these two people blocked the other, for a 1:1 born after the block. */
export async function blockedByAmong(ids: Types.ObjectId[]): Promise<Types.ObjectId[]> {
  if (ids.length !== 2) return [];
  const [first, second] = ids as [Types.ObjectId, Types.ObjectId];
  const blockers = await UserModel.find({ $or: [{ _id: first, blockedUsers: second }, { _id: second, blockedUsers: first }] }).select('_id').lean();
  return blockers.map((user) => user._id as Types.ObjectId);
}

/** Our 1:1s, personal and in every space: the block follows the person, not one chat. */
const directsBetween = (me: Types.ObjectId, other: Types.ObjectId) => ({ kind: 'direct' as const, 'members.userId': { $all: [me, other] }, members: { $size: 2 } });

async function tellBothSides(me: Types.ObjectId, other: Types.ObjectId): Promise<void> {
  const chats = await ChatModel.find(directsBetween(me, other)).select('_id').lean();
  for (const chat of chats) for (const id of [me, other]) avisarCambioDeChat(String(id), String(chat._id));
}

export async function blockUser(me: Types.ObjectId, rawOther: unknown): Promise<Outcome> {
  if (typeof rawOther !== 'string' || !Types.ObjectId.isValid(rawOther)) return { ok: false, status: 400, reason: 'Elige a quién bloquear.' };
  const other = new Types.ObjectId(rawOther);
  if (other.equals(me)) return { ok: false, status: 400, reason: 'No puedes bloquearte a ti.' };
  if (!(await UserModel.exists({ _id: other }))) return { ok: false, status: 404, reason: 'No encontramos a esa persona.' };
  await Promise.all([
    UserModel.updateOne({ _id: me }, { $addToSet: { blockedUsers: other } }),
    ChatModel.updateMany(directsBetween(me, other), { $addToSet: { blockedBy: me } }),
  ]);
  await tellBothSides(me, other);
  return { ok: true };
}

export async function unblockUser(me: Types.ObjectId, rawOther: string): Promise<Outcome> {
  if (!Types.ObjectId.isValid(rawOther)) return { ok: false, status: 400, reason: 'Elige a quién desbloquear.' };
  const other = new Types.ObjectId(rawOther);
  await Promise.all([
    UserModel.updateOne({ _id: me }, { $pull: { blockedUsers: other } }),
    ChatModel.updateMany(directsBetween(me, other), { $pull: { blockedBy: me } }),
  ]);
  await tellBothSides(me, other);
  return { ok: true };
}

export async function listBlocked(me: Types.ObjectId) {
  const user = await UserModel.findById(me).select('blockedUsers').lean();
  const ids = user?.blockedUsers ?? [];
  if (ids.length === 0) return [];
  const people = await UserModel.find({ _id: { $in: ids } }).select('name phone avatarUrl').lean();
  return people.map((person) => ({ id: String(person._id), name: person.name ?? null, phone: person.phone, avatarUrl: person.avatarUrl ? toAbsoluteMediaUrl(person.avatarUrl) : null }));
}

/**
 * «Contactos bloqueados» (pending 9), like WhatsApp: a blocked person cannot
 * write or call me in our 1:1 and neither of us sees the other's presence.
 * Groups are not touched. Mounted at `/api/me/blocked`.
 */
export function buildBlockedRouter(): Router {
  const router = Router();
  router.use(requireSession);
  router.get('/', asyncRoute(async (req, res) => {
    res.json({ blocked: await listBlocked(new Types.ObjectId(req.session!.userId)) });
  }));
  router.post('/', asyncRoute(async (req, res) => {
    const outcome = await blockUser(new Types.ObjectId(req.session!.userId), req.body?.userId);
    if (!outcome.ok) return res.status(outcome.status).json({ message: outcome.reason });
    return res.json({ ok: true });
  }));
  router.delete('/:userId', asyncRoute(async (req, res) => {
    const outcome = await unblockUser(new Types.ObjectId(req.session!.userId), String(req.params.userId));
    if (!outcome.ok) return res.status(outcome.status).json({ message: outcome.reason });
    return res.json({ ok: true });
  }));
  return router;
}

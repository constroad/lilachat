import type { Types } from 'mongoose';
import { ACCOUNT_DELETION_GRACE_DAYS, DELETED_ACCOUNT_NAME, deletedPhoneKey } from '@lilachat/shared';
import { ChatModel, ReceiptModel } from './chatModels.js';
import { DestacadoModel } from './destacadoModel.js';
import { ReminderModel } from './eventModels.js';
import { HiddenMessagesModel } from './hiddenMessages.js';
import { StickerModel } from './stickerModel.js';
import { RespaldoModel } from './respaldoModels.js';
import { AutoReplyStateModel } from './autoReply.js';
import { ScheduledMessageModel } from './scheduledMessages.js';
import { DeviceModel, InvitationModel, UserModel, type User } from './models.js';
import { WorkspaceEmailInviteModel, WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { CHAT_SCOPED, deleteBy, type AnyModel } from './workspacePurge.js';
import { managedMembershipsOf } from './accountDeletion.js';
import { deleteWorkspace } from './workspaceDelete.js';
import { noticeMembersChanged } from './workspaceNotices.js';
import { avisarCambioDeChat } from './reparto.js';

/**
 * The daily purge of «Borrar mi cuenta» (José 19/11). Past the grace, what is
 * the person's goes; their messages in groups and channels stay, and their
 * record stays too, renamed `DELETED_ACCOUNT_NAME` with an internal phone key,
 * so every screen that resolves an author reads «Cuenta eliminada».
 *
 * Every step can run twice: a crash halfway resumes in the next pass, and the
 * record is marked `deletedAt` only at the end.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_EVERY_MS = DAY_MS;
/** A few accounts per pass: each one is many deletes. */
const ACCOUNTS_PER_PASS = 5;

const asAny = (model: unknown) => model as AnyModel;
/** What hangs from the person alone, wherever it is. */
const OWN_ROWS_BY_USER: AnyModel[] = [DeviceModel, ReceiptModel, DestacadoModel, HiddenMessagesModel, StickerModel, ReminderModel, AutoReplyStateModel, RespaldoModel].map(asAny);

/** The fields that say who the person was; the record keeps only its id, the dates and the new name. */
const IDENTITY_FIELDS = ['email', 'avatarUrl', 'avatarMediaId', 'autoReply', 'presenceMode', 'lastSeenHidden', 'blockedUsers', 'readReceiptsOff', 'pushPreviewOff', 'chatLists', 'lastSeenAt', 'joinPending', 'birthday', 'birthdayVisible', 'emailVerifiedAt'] as const;

/** A space alone goes with the account; one that gained people during the grace passes to the longest there. */
async function settleSpacesInCharge(userId: Types.ObjectId): Promise<void> {
  const owned = (await managedMembershipsOf(userId)).filter((membership) => membership.role === 'owner');
  await Promise.all(owned.map((membership) =>
    membership.otherActiveMembers === 0
      ? deleteWorkspace(String(membership.workspaceId), userId, { confirmName: membership.spaceName })
      : handOverSpace(membership.workspaceId, userId)
  ));
}

async function handOverSpace(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
  const others = { workspaceId, status: 'active' as const, userId: { $exists: true, $ne: userId } };
  const heir = (await WorkspaceMemberModel.findOne({ ...others, role: 'admin' }).sort({ joinedAt: 1 }).lean()) ?? (await WorkspaceMemberModel.findOne(others).sort({ joinedAt: 1 }).lean());
  if (!heir?.userId) return;
  await WorkspaceMemberModel.updateOne({ _id: heir._id }, { $set: { role: 'owner' } });
  await WorkspaceModel.updateOne({ _id: workspaceId }, { $set: { ownerId: heir.userId } });
  console.warn(`[cuentas] el espacio ${String(workspaceId)} pasó a ${String(heir.userId)}: su dueño borró su cuenta`);
}

/** Out of every space: the rows go, and the spaces' people refresh their directory. */
async function leaveEverySpace(userId: Types.ObjectId): Promise<void> {
  const spaces = await WorkspaceMemberModel.distinct('workspaceId', { userId });
  await WorkspaceMemberModel.deleteMany({ userId });
  await Promise.all(spaces.map((workspaceId) => noticeMembersChanged(workspaceId).catch(() => undefined)));
}

/** Their 1:1s and notes go whole, for both sides; the other person's list reads again. */
async function eraseOwnChats(userId: Types.ObjectId): Promise<void> {
  const chats = await ChatModel.find({ kind: { $in: ['direct', 'notas'] }, 'members.userId': userId }).select('_id members.userId').lean();
  const chatIds = { $in: chats.map((chat) => chat._id) };
  await Promise.all([...CHAT_SCOPED, asAny(HiddenMessagesModel)].map((model) => deleteBy(model, 'chatId', chatIds)));
  await ChatModel.deleteMany({ _id: chatIds });
  for (const chat of chats) {
    for (const member of chat.members) if (!member.userId.equals(userId)) avisarCambioDeChat(String(member.userId), String(chat._id));
  }
}

/** In groups and channels the messages stay; the person leaves their member lists. */
async function leaveEveryGroup(userId: Types.ObjectId): Promise<void> {
  await ChatModel.updateMany({ $or: [{ 'members.userId': userId }, { 'suspendedMembers.userId': userId }, { blockedBy: userId }] }, { $pull: { members: { userId }, suspendedMembers: { userId }, blockedBy: userId } });
}

async function eraseOwnRows(user: Pick<User, '_id' | 'phone' | 'email'>): Promise<void> {
  await Promise.all([
    ...OWN_ROWS_BY_USER.map((model) => deleteBy(model, 'userId', user._id)),
    deleteBy(asAny(ScheduledMessageModel), 'senderId', user._id),
    deleteBy(asAny(InvitationModel), 'phone', user.phone),
    ...(user.email ? [deleteBy(asAny(WorkspaceEmailInviteModel), 'email', user.email)] : []),
    UserModel.updateMany({ blockedUsers: user._id }, { $pull: { blockedUsers: user._id } }),
  ]);
}

async function anonymize(userId: Types.ObjectId, now: Date): Promise<void> {
  const unset = Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, 1]));
  await UserModel.updateOne({ _id: userId, deletedAt: { $exists: false } }, { $set: { name: DELETED_ACCOUNT_NAME, phone: deletedPhoneKey(String(userId)), deletedAt: now }, $unset: unset });
}

/** One account whose deletion was asked; an erased one is left as it is. */
export async function purgeAccount(userId: Types.ObjectId, now: Date = new Date()): Promise<void> {
  const user = await UserModel.findOne({ _id: userId, deletionRequestedAt: { $exists: true } }).select('phone email deletedAt').lean<Pick<User, '_id' | 'phone' | 'email' | 'deletedAt'> | null>();
  if (!user) throw new Error('purge: that account did not ask to be deleted');
  if (user.deletedAt) return;
  await settleSpacesInCharge(userId);
  await leaveEverySpace(userId);
  await eraseOwnChats(userId);
  await leaveEveryGroup(userId);
  await eraseOwnRows(user);
  await anonymize(userId, now);
}

/** One pass: the accounts asked more than the grace ago. Returns how many went. */
export async function purgeDueAccounts(now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - ACCOUNT_DELETION_GRACE_DAYS * DAY_MS);
  const due = await UserModel.find({ deletionRequestedAt: { $lte: before }, deletedAt: { $exists: false } }).select('_id').limit(ACCOUNTS_PER_PASS).lean();
  for (const account of due) await purgeAccount(account._id, now);
  return due.length;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Inside the server, like the other sweeps; a day late is fine for a 30-day clock. */
export function startAccountPurgeCron(): void {
  if (timer) return;
  const tick = () => void purgeDueAccounts().catch((error) => console.error('[cron] purga de cuentas:', error instanceof Error ? error.message : error));
  timer = setInterval(tick, PURGE_EVERY_MS);
  tick();
}

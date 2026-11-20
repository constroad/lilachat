import type { Types } from 'mongoose';
import { accountDeletionDeadline, deletionBlockedMessage, spacesBlockingDeletion, type DeletionMembership, type WorkspaceRole } from '@lilachat/shared';
import { DeviceModel, UserModel, type User } from './models.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { markAccountClosed, markAccountOpen } from './closedAccounts.js';
import { disconnectUser } from './reparto.js';

/**
 * «Borrar mi cuenta» (José 19/11, Google Play). Asking closes the account at
 * once: its devices go (sessions, push tokens, linked webs) and every socket is
 * cut. The data is erased by the daily purge (`accountPurge.ts`) after the
 * grace; signing in with the code before that cancels it (`authRoutes.ts`).
 */
export class AccountDeletionError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export type AccountDeletionStatus = { requested: false } | { requested: true; requestedAt: string; deadline: string };

const SPACE_LEADS: WorkspaceRole[] = ['owner', 'admin'];

/** The live spaces this person is in charge of, with who else is there. */
export async function managedMembershipsOf(userId: Types.ObjectId): Promise<(DeletionMembership & { workspaceId: Types.ObjectId })[]> {
  const mine = await WorkspaceMemberModel.find({ userId, status: 'active', role: { $in: SPACE_LEADS } }).select('workspaceId role').lean();
  const rows = await Promise.all(mine.map(async (member) => {
    const others = { workspaceId: member.workspaceId, status: 'active' as const, userId: { $exists: true, $ne: userId } };
    const [space, otherActiveMembers, otherManagers] = await Promise.all([
      WorkspaceModel.findOne({ _id: member.workspaceId, deletedAt: { $exists: false } }).select('name').lean(),
      WorkspaceMemberModel.countDocuments(others),
      WorkspaceMemberModel.countDocuments({ ...others, role: { $in: SPACE_LEADS } }),
    ]);
    return space ? [{ workspaceId: member.workspaceId, spaceName: space.name, role: member.role, otherActiveMembers, otherManagers }] : [];
  }));
  return rows.flat();
}

const statusOf = (requestedAt: Date | undefined): AccountDeletionStatus =>
  requestedAt ? { requested: true, requestedAt: requestedAt.toISOString(), deadline: accountDeletionDeadline(requestedAt).toISOString() } : { requested: false };

const liveAccount = (userId: Types.ObjectId) =>
  UserModel.findOne({ _id: userId, deletedAt: { $exists: false }, app: { $exists: false } }).select('deletionRequestedAt').lean<Pick<User, '_id' | 'deletionRequestedAt'> | null>();

export async function accountDeletionStatusOf(userId: Types.ObjectId): Promise<AccountDeletionStatus> {
  const account = await liveAccount(userId);
  if (!account) throw new AccountDeletionError(404, 'No encontramos tu cuenta.');
  return statusOf(account.deletionRequestedAt);
}

/** Asks for it: refused while the person runs a space with other people; asking twice keeps the first date. */
export async function requestAccountDeletion(userId: Types.ObjectId, now: Date = new Date()): Promise<AccountDeletionStatus> {
  const account = await liveAccount(userId);
  if (!account) throw new AccountDeletionError(404, 'No encontramos tu cuenta.');
  const blocking = spacesBlockingDeletion(await managedMembershipsOf(userId));
  if (blocking.length > 0) throw new AccountDeletionError(409, deletionBlockedMessage(blocking));
  const requestedAt = account.deletionRequestedAt ?? now;
  await UserModel.updateOne({ _id: userId, deletionRequestedAt: { $exists: false } }, { $set: { deletionRequestedAt: requestedAt } });
  await closeAccount(userId);
  return statusOf(requestedAt);
}

/** Closed now: no device keeps a session or a push token, and no socket stays open. */
async function closeAccount(userId: Types.ObjectId): Promise<void> {
  markAccountClosed(String(userId));
  await DeviceModel.deleteMany({ userId });
  disconnectUser(String(userId));
}

/** Inside the grace the account comes back as it was. `true` when there was a deletion to cancel. */
export async function cancelAccountDeletion(userId: Types.ObjectId): Promise<boolean> {
  const result = await UserModel.updateOne({ _id: userId, deletionRequestedAt: { $exists: true }, deletedAt: { $exists: false } }, { $unset: { deletionRequestedAt: 1 } });
  if (result.modifiedCount > 0) markAccountOpen(String(userId));
  return result.modifiedCount > 0;
}

import type { Types } from 'mongoose';
import { canManageMembers, type WorkspaceMemberStatus, type WorkspaceRole } from '@lilachat/shared';
import { UserModel } from './models.js';
import { WorkspaceMemberModel } from './workspaceModels.js';

/** What «my spaces» adds per membership beyond the counts (designs `e1-11`, `e1-13`, `e1-14`). */
type Membership = { workspaceId: Types.ObjectId; role: WorkspaceRole; status: WorkspaceMemberStatus; addedBy?: Types.ObjectId };
type Person = { name?: string; phone: string };
export type MembershipExtras = { pendingRequests?: number; addedBy?: Person; admins?: (Person & { userId: string })[] };

/** Requests waiting in the spaces where I approve them: the badge of «Solicitudes». */
async function pendingRequestsOf(workspaceIds: Types.ObjectId[]): Promise<Map<string, number>> {
  if (workspaceIds.length === 0) return new Map();
  const rows = await WorkspaceMemberModel.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { workspaceId: { $in: workspaceIds }, status: 'pending' } }, { $group: { _id: '$workspaceId', count: { $sum: 1 } } }]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

/** The admins of the spaces where my access was removed: «Hablar con un admin» (e1-14). */
async function adminsOf(workspaceIds: Types.ObjectId[]): Promise<Map<string, { userId: Types.ObjectId; workspaceId: Types.ObjectId }[]>> {
  if (workspaceIds.length === 0) return new Map();
  const rows = await WorkspaceMemberModel.find({ workspaceId: { $in: workspaceIds }, status: 'active', role: { $in: ['owner', 'admin'] }, userId: { $exists: true } }).select('workspaceId userId').lean();
  const byWorkspace = new Map<string, { userId: Types.ObjectId; workspaceId: Types.ObjectId }[]>();
  for (const row of rows) byWorkspace.set(String(row.workspaceId), [...(byWorkspace.get(String(row.workspaceId)) ?? []), { userId: row.userId!, workspaceId: row.workspaceId }]);
  return byWorkspace;
}

export async function membershipExtras(userId: Types.ObjectId, memberships: Membership[]): Promise<Map<string, MembershipExtras>> {
  const approving = memberships.filter((m) => m.status === 'active' && canManageMembers(m.role)).map((m) => m.workspaceId);
  const removed = memberships.filter((m) => m.status === 'deactivated').map((m) => m.workspaceId);
  const [pending, admins] = await Promise.all([pendingRequestsOf(approving), adminsOf(removed)]);
  const addedByIds = memberships.flatMap((m) => (m.addedBy && String(m.addedBy) !== String(userId) ? [m.addedBy] : []));
  const peopleIds = [...addedByIds, ...[...admins.values()].flat().map((admin) => admin.userId)];
  const people = new Map((await UserModel.find({ _id: { $in: peopleIds } }).select('name phone').lean()).map((user) => [String(user._id), { name: user.name, phone: user.phone }]));
  const extras = new Map<string, MembershipExtras>();
  for (const m of memberships) {
    const key = String(m.workspaceId);
    const extra: MembershipExtras = {};
    if (pending.has(key) || approving.some((id) => String(id) === key)) extra.pendingRequests = pending.get(key) ?? 0;
    const adder = m.addedBy && String(m.addedBy) !== String(userId) ? people.get(String(m.addedBy)) : undefined;
    if (adder) extra.addedBy = adder;
    if (m.status === 'deactivated') extra.admins = (admins.get(key) ?? []).flatMap((admin) => (people.has(String(admin.userId)) ? [{ userId: String(admin.userId), ...people.get(String(admin.userId))! }] : []));
    extras.set(key, extra);
  }
  return extras;
}

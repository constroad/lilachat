import { Types } from 'mongoose';
import { canManageMembers, type SpaceInvitation } from '@lilachat/shared';
import { normalizeEmail } from './invitationGate.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { UserModel } from './models.js';
import { WorkspaceEmailInviteModel, WorkspaceMemberModel, WorkspaceModel, type WorkspaceMember } from './workspaceModels.js';
import { welcomeToGeneral } from './workspaceGeneral.js';
import { noticeSpacesChanged } from './workspaceNotices.js';
import { actorIn, cleanText, ONLY_ADMINS, WorkspaceError } from './workspaces.js';

/**
 * A company invites by email (José, 22/10): one account per person. The person
 * signs in with their phone as always; the space admits them when they VERIFY
 * that email in their profile (`claimEmailInvites`, called by
 * `profileRoutes.ts`). An email a verified account already owns admits it at
 * once. An unverified email admits nobody: it proves nothing.
 */
type MemberFields = { title?: string; area?: string };

const fieldsOf = (input: { title?: unknown; area?: unknown }): MemberFields => {
  const fields = { title: cleanText(input.title, 60), area: cleanText(input.area, 40) };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value)) as MemberFields;
};

/** The account becomes an active member (and lands in #general); a person an admin deactivated stays out. */
async function admitAccount(workspaceId: Types.ObjectId, user: { _id: Types.ObjectId; phone: string }, addedBy: Types.ObjectId, fields: MemberFields): Promise<WorkspaceMember> {
  const existing = await WorkspaceMemberModel.findOne({ workspaceId, phone: user.phone }).lean<WorkspaceMember | null>();
  if (existing?.status === 'deactivated') throw new WorkspaceError(409, 'Un admin desactivó a esa persona en el espacio. Reactívala desde Miembros.');
  if (existing?.status === 'active') return existing;
  const member = await WorkspaceMemberModel.findOneAndUpdate(
    { workspaceId, phone: user.phone },
    { $set: { userId: user._id, status: 'active', joinedAt: new Date(), ...fields }, $setOnInsert: { role: 'member', addedBy } },
    { upsert: true, returnDocument: 'after' }
  ).lean<WorkspaceMember>();
  await welcomeToGeneral(workspaceId, user._id);
  noticeSpacesChanged([user._id]);
  return member;
}

export async function inviteByEmail(workspaceId: string, actorId: Types.ObjectId, input: { email?: unknown; title?: unknown; area?: unknown }) {
  const actor = await actorIn(workspaceId, actorId);
  if (!canManageMembers(actor.role)) throw new WorkspaceError(403, ONLY_ADMINS);
  const email = normalizeEmail(input.email);
  if (!email) throw new WorkspaceError(400, 'Ese correo no parece válido.');
  const fields = fieldsOf(input);
  const owner = await UserModel.findOne({ email, emailVerifiedAt: { $exists: true } }).select('_id phone').lean();
  if (owner) {
    const member = await admitAccount(actor.workspaceId, owner, actorId, fields);
    return { id: String(member._id), email, status: 'active' as const };
  }
  const invite = await WorkspaceEmailInviteModel.findOneAndUpdate(
    { workspaceId: actor.workspaceId, email },
    { $set: fields, $setOnInsert: { addedBy: actorId } },
    { upsert: true, returnDocument: 'after' }
  ).lean();
  return { id: String(invite!._id), email, status: 'invited' as const };
}

/** The «Invitados» list shows the emails waiting too, next to the phones. */
export async function emailInvitesOf(workspaceId: Types.ObjectId) {
  const invites = await WorkspaceEmailInviteModel.find({ workspaceId }).sort({ createdAt: 1 }).lean();
  return invites.map((invite) => ({ id: String(invite._id), email: invite.email, role: 'member' as const, status: 'invited' as const, title: invite.title, area: invite.area, requestedAt: invite.createdAt }));
}

export async function revokeEmailInvite(workspaceId: string, actorId: Types.ObjectId, inviteId: string): Promise<void> {
  const actor = await actorIn(workspaceId, actorId);
  if (!canManageMembers(actor.role)) throw new WorkspaceError(403, ONLY_ADMINS);
  if (!Types.ObjectId.isValid(inviteId)) throw new WorkspaceError(404, 'Esa invitación no existe.');
  const removed = await WorkspaceEmailInviteModel.deleteOne({ _id: inviteId, workspaceId: actor.workspaceId });
  if (removed.deletedCount === 0) throw new WorkspaceError(404, 'Esa invitación no existe.');
}

/** The person just verified this email: every space that invited it admits them. Returns how many did. */
export async function claimEmailInvites(userId: Types.ObjectId, email: string): Promise<number> {
  const invites = await WorkspaceEmailInviteModel.find({ email }).lean();
  if (invites.length === 0) return 0;
  const user = await UserModel.findById(userId).select('_id phone').lean();
  if (!user) return 0;
  let admitted = 0;
  for (const invite of invites) {
    try {
      await admitAccount(invite.workspaceId, user, invite.addedBy, fieldsOf(invite));
      admitted += 1;
    } catch (error) {
      // Deactivated in that space: the invitation goes away and they stay out.
      if (!(error instanceof WorkspaceError)) throw error;
    }
  }
  await WorkspaceEmailInviteModel.deleteMany({ _id: { $in: invites.map((invite) => invite._id) } });
  return admitted;
}

async function verifiedAccount(userId: Types.ObjectId) {
  return UserModel.findOne({ _id: userId, emailVerifiedAt: { $exists: true } }).select('_id phone email').lean();
}

/** «Tus espacios» (design i-03): whoever signs in by email sees them and chooses, like Slack's Join. */
export async function invitationsOf(userId: Types.ObjectId): Promise<SpaceInvitation[]> {
  const account = await verifiedAccount(userId);
  if (!account?.email) return [];
  const invites = await WorkspaceEmailInviteModel.find({ email: account.email }).sort({ createdAt: 1 }).lean();
  const [workspaces, inviters] = await Promise.all([
    WorkspaceModel.find({ _id: { $in: invites.map((invite) => invite.workspaceId) } }).select('name logoUrl').lean(),
    UserModel.find({ _id: { $in: invites.map((invite) => invite.addedBy) } }).select('name').lean(),
  ]);
  const spaces = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]));
  const names = new Map(inviters.map((inviter) => [String(inviter._id), inviter.name]));
  return invites.flatMap((invite) => {
    const space = spaces.get(String(invite.workspaceId));
    if (!space) return [];
    const logoUrl = space.logoUrl ? toAbsoluteMediaUrl(space.logoUrl) : undefined;
    return [{ id: String(invite._id), workspace: { id: String(space._id), name: space.name, ...(logoUrl ? { logoUrl } : {}) }, invitedBy: names.get(String(invite.addedBy)) ?? null }];
  });
}

export async function acceptInvitation(inviteId: string, userId: Types.ObjectId): Promise<{ workspaceId: string }> {
  const account = await verifiedAccount(userId);
  const invite = account?.email && Types.ObjectId.isValid(inviteId) ? await WorkspaceEmailInviteModel.findOne({ _id: inviteId, email: account.email }).lean() : null;
  if (!account || !invite) throw new WorkspaceError(404, 'Esa invitación ya no está.');
  try {
    await admitAccount(invite.workspaceId, account, invite.addedBy, fieldsOf(invite));
  } finally {
    // Someone deactivated in that space gets the refusal once: the invitation does not stay stuck.
    await WorkspaceEmailInviteModel.deleteOne({ _id: invite._id });
  }
  return { workspaceId: String(invite.workspaceId) };
}

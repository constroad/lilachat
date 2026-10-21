import { Types } from 'mongoose';
import {
  canChangeRole,
  canDeactivate,
  canManageMembers,
  makeJoinCode,
  normalizeJoinCode,
  normalizePeruPhone,
  statusAfterJoin,
  type JoinPolicy,
  type WorkspaceMemberStatus,
  type WorkspaceRole,
} from '@lilachat/shared';
import { InvitationModel, UserModel } from './models.js';
import { ChatModel, ReceiptModel } from './chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel, type Workspace, type WorkspaceMember } from './workspaceModels.js';
import { leaveWorkspaceChats, restoreToWorkspaceChats, suspendFromWorkspaceChats } from './workspaceChats.js';

/** A refusal with its HTTP status; the routes turn it into the response. */
export class WorkspaceError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) {
    super(message);
  }
}

const CODE_ATTEMPTS = 5;
const NAME_MAX = 60;
const NOT_FOUND = 'Ese espacio no existe o no estás en él.';
const ONLY_ADMINS = 'Solo un admin del espacio puede hacer eso.';

const cleanText = (value: unknown, max: number): string | undefined => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined);
const isRole = (value: unknown): value is WorkspaceRole => value === 'owner' || value === 'admin' || value === 'member' || value === 'guest';
const asPolicy = (value: unknown): JoinPolicy | undefined => (value === 'open' || value === 'approval' ? value : undefined);
const asId = (value: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) throw new WorkspaceError(404, NOT_FOUND);
  return new Types.ObjectId(value);
};

async function uniqueCode(name: string): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = makeJoinCode(name);
    if (!(await WorkspaceModel.exists({ joinCode: code }))) return code;
  }
  throw new WorkspaceError(409, 'No se pudo generar un código. Prueba de nuevo.');
}

export function toClientWorkspace(workspace: Workspace, member: Pick<WorkspaceMember, 'role' | 'status'>) {
  return {
    id: String(workspace._id),
    name: workspace.name,
    rubro: workspace.rubro,
    logoUrl: workspace.logoUrl,
    joinPolicy: workspace.joinPolicy,
    role: member.role,
    status: member.status,
    // The code is for those who can invite; a member asks an admin.
    ...(canManageMembers(member.role) ? { joinCode: workspace.joinCode } : {}),
  };
}

export async function createWorkspace(ownerId: Types.ObjectId, input: { name?: unknown; rubro?: unknown; joinPolicy?: unknown }) {
  const name = cleanText(input.name, NAME_MAX);
  if (!name) throw new WorkspaceError(400, 'Ponle un nombre al espacio.');
  const owner = await UserModel.findById(ownerId).select('phone').lean();
  if (!owner) throw new WorkspaceError(404, 'No encontramos tu cuenta.');
  const workspace = await WorkspaceModel.create({ name, rubro: cleanText(input.rubro, 40), ownerId, joinCode: await uniqueCode(name), joinPolicy: asPolicy(input.joinPolicy) ?? 'approval' });
  const member = await WorkspaceMemberModel.create({ workspaceId: workspace._id, userId: ownerId, phone: owner.phone, role: 'owner', status: 'active', joinedAt: new Date() });
  return toClientWorkspace(workspace.toObject(), member);
}

async function workspaceByCode(code: unknown): Promise<Workspace> {
  const normalized = typeof code === 'string' ? normalizeJoinCode(code) : null;
  const workspace = normalized ? await WorkspaceModel.findOne({ joinCode: normalized }).lean<Workspace | null>() : null;
  if (!workspace) throw new WorkspaceError(404, 'Ese código no es de ningún espacio.');
  return workspace;
}

export async function previewByCode(code: unknown) {
  const workspace = await workspaceByCode(code);
  const members = await WorkspaceMemberModel.countDocuments({ workspaceId: workspace._id, status: 'active' });
  return { id: String(workspace._id), name: workspace.name, rubro: workspace.rubro, logoUrl: workspace.logoUrl, members, joinPolicy: workspace.joinPolicy };
}

export async function joinByCode(userId: Types.ObjectId, code: unknown): Promise<{ workspaceId: string; status: WorkspaceMemberStatus }> {
  const workspace = await workspaceByCode(code);
  const user = await UserModel.findById(userId).select('phone').lean();
  if (!user) throw new WorkspaceError(404, 'No encontramos tu cuenta.');
  const existing = await WorkspaceMemberModel.findOne({ workspaceId: workspace._id, phone: user.phone }).lean<WorkspaceMember | null>();
  if (existing?.status === 'deactivated') throw new WorkspaceError(403, 'Un admin desactivó tu acceso a este espacio.');
  if (existing?.status === 'invited') {
    await WorkspaceMemberModel.updateOne({ _id: existing._id }, { $set: { userId, status: 'active', joinedAt: new Date() } });
    return { workspaceId: String(workspace._id), status: 'active' };
  }
  if (existing) return { workspaceId: String(workspace._id), status: existing.status };
  const status = statusAfterJoin(workspace.joinPolicy);
  await WorkspaceMemberModel.create({ workspaceId: workspace._id, userId, phone: user.phone, role: 'member', status, ...(status === 'active' ? { joinedAt: new Date() } : {}) });
  return { workspaceId: String(workspace._id), status };
}

export async function myWorkspaces(userId: Types.ObjectId) {
  const memberships = await WorkspaceMemberModel.find({ userId, status: { $in: ['active', 'pending', 'deactivated'] } }).select('workspaceId role status').lean();
  const ids = memberships.map((m) => m.workspaceId);
  const [workspaces, counts, unread] = await Promise.all([WorkspaceModel.find({ _id: { $in: ids } }).lean<Workspace[]>(), activeMembersOf(ids), unreadChatsOf(userId, ids)]);
  const byId = new Map(workspaces.map((w) => [String(w._id), w]));
  return memberships.flatMap((m) => {
    const workspace = byId.get(String(m.workspaceId));
    const key = String(m.workspaceId);
    return workspace ? [{ ...toClientWorkspace(workspace, m), members: counts.get(key) ?? 0, unreadChats: m.status === 'active' ? (unread.get(key) ?? 0) : 0 }] : [];
  });
}

/** «48 miembros» on the space switcher (design `e1-06`): the active ones, in one aggregation for all my spaces. */
async function activeMembersOf(workspaceIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const rows = await WorkspaceMemberModel.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { workspaceId: { $in: workspaceIds }, status: 'active' } }, { $group: { _id: '$workspaceId', count: { $sum: 1 } } }]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

/** The switcher's badge: how many of my chats in each space have something I have not read (like WhatsApp counts chats, not messages). */
async function unreadChatsOf(userId: Types.ObjectId, workspaceIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const chats = await ChatModel.find({ workspaceId: { $in: workspaceIds }, 'members.userId': userId, lastSeq: { $gt: 0 } }).select('workspaceId lastSeq').lean();
  if (chats.length === 0) return new Map();
  const receipts = await ReceiptModel.find({ userId, chatId: { $in: chats.map((chat) => chat._id) } }).select('chatId readSeq').lean();
  const readSeq = new Map(receipts.map((receipt) => [String(receipt.chatId), receipt.readSeq]));
  const unread = new Map<string, number>();
  for (const chat of chats) {
    if (chat.lastSeq > (readSeq.get(String(chat._id)) ?? 0)) unread.set(String(chat.workspaceId), (unread.get(String(chat.workspaceId)) ?? 0) + 1);
  }
  return unread;
}

/** The person's ACTIVE membership in the space, or a 404 that says nothing about the space. */
export async function actorIn(workspaceId: string, userId: Types.ObjectId): Promise<WorkspaceMember> {
  const member = await WorkspaceMemberModel.findOne({ workspaceId: asId(workspaceId), userId, status: 'active' }).lean<WorkspaceMember | null>();
  if (!member) throw new WorkspaceError(404, NOT_FOUND);
  return member;
}

async function toClientMembers(members: WorkspaceMember[]) {
  const users = await UserModel.find({ _id: { $in: members.flatMap((m) => (m.userId ? [m.userId] : [])) } }).select('name avatarUrl').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return members.map((m) => {
    const user = m.userId ? byId.get(String(m.userId)) : undefined;
    return { id: String(m._id), userId: m.userId ? String(m.userId) : undefined, name: user?.name, avatarUrl: user?.avatarUrl, phone: m.phone, role: m.role, status: m.status, title: m.title, area: m.area };
  });
}

export async function listMembers(workspaceId: string, userId: Types.ObjectId, status: unknown) {
  const actor = await actorIn(workspaceId, userId);
  const wanted: WorkspaceMemberStatus = status === 'pending' || status === 'invited' || status === 'deactivated' ? status : 'active';
  if (wanted !== 'active' && !canManageMembers(actor.role)) throw new WorkspaceError(403, ONLY_ADMINS);
  const members = await WorkspaceMemberModel.find({ workspaceId: actor.workspaceId, status: wanted }).sort({ createdAt: 1 }).lean<WorkspaceMember[]>();
  return toClientMembers(members);
}

export async function addByPhone(workspaceId: string, actorId: Types.ObjectId, input: { phone?: unknown; title?: unknown; area?: unknown }) {
  const actor = await actorIn(workspaceId, actorId);
  if (!canManageMembers(actor.role)) throw new WorkspaceError(403, ONLY_ADMINS);
  const phone = normalizePeruPhone(input.phone);
  if (!phone) throw new WorkspaceError(400, 'Ese número no parece un celular de Perú.');
  const user = await UserModel.findOne({ phone }).select('_id').lean();
  const fields = { title: cleanText(input.title, 60), area: cleanText(input.area, 40) };
  const member = await WorkspaceMemberModel.findOneAndUpdate(
    { workspaceId: actor.workspaceId, phone },
    { $setOnInsert: { role: 'member', addedBy: actorId, status: user ? 'active' : 'invited', ...(user ? { userId: user._id, joinedAt: new Date() } : {}) }, $set: Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) },
    { upsert: true, returnDocument: 'after' }
  ).lean<WorkspaceMember>();
  // Without an account they could not sign up: the space invites them to Lilachat too.
  if (!user) await InvitationModel.updateOne({ phone }, { $setOnInsert: { phone, status: 'invited' } }, { upsert: true });
  return (await toClientMembers([member]))[0]!;
}

function checkMemberChange(actor: WorkspaceMember, target: WorkspaceMember, change: { status?: unknown; role?: unknown }): void {
  if (!canManageMembers(actor.role)) throw new WorkspaceError(403, ONLY_ADMINS);
  if (change.status === 'deactivated' && !canDeactivate({ actor: actor.role, target: target.role })) throw new WorkspaceError(403, 'No puedes desactivar a esa persona.');
  if (change.status === 'active' && target.status === 'deactivated' && !canDeactivate({ actor: actor.role, target: target.role })) throw new WorkspaceError(403, ONLY_ADMINS);
  if (change.role !== undefined && (!isRole(change.role) || !canChangeRole({ actor: actor.role, target: target.role, to: change.role }))) throw new WorkspaceError(403, 'No puedes darle ese rol.');
}

export async function updateMember(workspaceId: string, actorId: Types.ObjectId, memberId: string, change: { status?: unknown; role?: unknown; title?: unknown; area?: unknown }) {
  const actor = await actorIn(workspaceId, actorId);
  const target = await WorkspaceMemberModel.findOne({ _id: asId(memberId), workspaceId: actor.workspaceId }).lean<WorkspaceMember | null>();
  if (!target) throw new WorkspaceError(404, 'Esa persona no está en el espacio.');
  checkMemberChange(actor, target, change);
  const set: Partial<WorkspaceMember> = {};
  if (change.status === 'active' || change.status === 'deactivated') set.status = change.status;
  if (change.status === 'active' && target.status !== 'active') set.joinedAt = new Date();
  if (isRole(change.role)) set.role = change.role;
  const title = cleanText(change.title, 60);
  const area = cleanText(change.area, 40);
  if (title) set.title = title;
  if (area) set.area = area;
  const updated = await WorkspaceMemberModel.findOneAndUpdate({ _id: target._id }, { $set: set }, { returnDocument: 'after' }).lean<WorkspaceMember>();
  if (!updated) throw new WorkspaceError(404, 'Esa persona no está en el espacio.');
  if (target.userId && set.status === 'deactivated') await suspendFromWorkspaceChats(actor.workspaceId, target.userId);
  if (target.userId && set.status === 'active' && target.status === 'deactivated') await restoreToWorkspaceChats(actor.workspaceId, target.userId);
  return (await toClientMembers([updated]))[0]!;
}

export async function updateWorkspace(workspaceId: string, actorId: Types.ObjectId, change: { name?: unknown; rubro?: unknown; joinPolicy?: unknown; newCode?: unknown }) {
  const actor = await actorIn(workspaceId, actorId);
  if (!canManageMembers(actor.role)) throw new WorkspaceError(403, ONLY_ADMINS);
  const current = await WorkspaceModel.findById(actor.workspaceId).lean<Workspace | null>();
  if (!current) throw new WorkspaceError(404, NOT_FOUND);
  const set: Partial<Workspace> = {};
  const name = cleanText(change.name, NAME_MAX);
  if (name) set.name = name;
  const rubro = cleanText(change.rubro, 40);
  if (rubro) set.rubro = rubro;
  const policy = asPolicy(change.joinPolicy);
  if (policy) set.joinPolicy = policy;
  if (change.newCode === true) set.joinCode = await uniqueCode(name ?? current.name);
  const updated = await WorkspaceModel.findOneAndUpdate({ _id: current._id }, { $set: set }, { returnDocument: 'after' }).lean<Workspace>();
  if (!updated) throw new WorkspaceError(404, NOT_FOUND);
  return toClientWorkspace(updated, actor);
}

export async function leaveWorkspace(workspaceId: string, userId: Types.ObjectId): Promise<void> {
  // A request still waiting for approval is withdrawn («Cancelar solicitud», design `e1-03`): it never had chats.
  const pending = await WorkspaceMemberModel.findOneAndDelete({ workspaceId: asId(workspaceId), userId, status: 'pending' }).lean();
  if (pending) return;
  const member = await actorIn(workspaceId, userId);
  if (member.role === 'owner') throw new WorkspaceError(409, 'Eres el dueño: pásale el espacio a otra persona antes de salir.');
  await WorkspaceMemberModel.deleteOne({ _id: member._id });
  await leaveWorkspaceChats(member.workspaceId, userId);
}

/** A phone added to spaces before it had an account joins them when it signs up. */
export async function claimPhoneInvites(userId: Types.ObjectId, phone: string): Promise<number> {
  const result = await WorkspaceMemberModel.updateMany({ phone, status: 'invited' }, { $set: { userId, status: 'active', joinedAt: new Date() } });
  return result.modifiedCount;
}

import { Types } from 'mongoose';
import { canManageMembers, CLIENT_ID, memberAccessOf, type MemberAccess } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { actorIn, ONLY_ADMINS, WorkspaceError } from '../workspaces.js';
import { memberAccessFrom } from '../stageAccess.js';
import { ClientChannelModel, type ClientChannel, type RestrictedMember } from './botClients.js';

const NOT_IN_CHANNEL = 'Esa persona no está en el canal de este cliente.';
const CLIENT_NOT_FOUND = 'Ese cliente no existe en este espacio.';
const ADMIN_SEES_ALL = 'Un admin del espacio ve todo el canal.';

type Viewers = { viewers: string[] };
/** `admins`: the channel's members who are admins of the space; they always see everything. */
type AccessList = Viewers & { restricted: (MemberAccess & { user_id: string })[]; admins: string[] };
type ClientKey = Pick<ClientChannel, '_id' | 'workspaceId' | 'chatId' | 'billingViewers' | 'restrictedMembers'>;

/** The client's channel, only for an admin of the space (José 30/10: admins choose who else sees the collection). */
async function clientForAdmin(workspaceId: string, clientId: string, userId: Types.ObjectId): Promise<ClientKey> {
  const actor = await actorIn(workspaceId, userId);
  if (!canManageMembers(actor.role)) throw new WorkspaceError(403, ONLY_ADMINS);
  const client = CLIENT_ID.test(clientId) ? await ClientChannelModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), clientId }).select('workspaceId chatId billingViewers restrictedMembers').lean<ClientKey | null>() : null;
  if (!client) throw new WorkspaceError(404, CLIENT_NOT_FOUND);
  return client;
}

async function memberOfChannel(client: ClientKey, targetId: string): Promise<Types.ObjectId> {
  if (!Types.ObjectId.isValid(targetId) || !(await ChatModel.exists({ _id: client.chatId, 'members.userId': new Types.ObjectId(targetId) }))) throw new WorkspaceError(404, NOT_IN_CHANNEL);
  return new Types.ObjectId(targetId);
}

const isSpaceAdmin = async (workspaceId: Types.ObjectId, userId: Types.ObjectId) => {
  const member = await WorkspaceMemberModel.findOne({ workspaceId, userId, status: 'active' }).select('role').lean();
  return Boolean(member && canManageMembers(member.role));
};

const wire = (viewers: readonly Types.ObjectId[] | undefined): Viewers => ({ viewers: (viewers ?? []).map(String) });
async function channelAdmins(client: Pick<ClientChannel, 'workspaceId' | 'chatId'>): Promise<string[]> {
  const chat = await ChatModel.findById(client.chatId).select('members.userId').lean();
  const ids = (chat?.members ?? []).map((member) => member.userId);
  const admins = await WorkspaceMemberModel.find({ workspaceId: client.workspaceId, userId: { $in: ids }, status: 'active', role: { $in: ['owner', 'admin'] } }).select('userId').lean();
  return admins.map((admin) => String(admin.userId));
}

const accessWire = async (client: Pick<ClientChannel, 'workspaceId' | 'chatId' | 'billingViewers' | 'restrictedMembers'>): Promise<AccessList> => ({
  ...wire(client.billingViewers),
  restricted: (client.restrictedMembers ?? []).map((entry) => ({ user_id: String(entry.userId), ...memberAccessFrom(entry) })),
  admins: await channelAdmins(client),
});

export async function listBillingViewers(workspaceId: string, clientId: string, userId: Types.ObjectId): Promise<Viewers> {
  return wire((await clientForAdmin(workspaceId, clientId, userId)).billingViewers);
}

/** Marks or unmarks a member of the client's channel; marking twice keeps one. */
export async function setBillingViewer(workspaceId: string, clientId: string, userId: Types.ObjectId, targetId: string, body: { sees?: unknown }): Promise<Viewers> {
  if (typeof body.sees !== 'boolean') throw new WorkspaceError(400, 'Falta «sees» (true o false).');
  const client = await clientForAdmin(workspaceId, clientId, userId);
  const target = await memberOfChannel(client, targetId);
  const update = body.sees ? { $addToSet: { billingViewers: target } } : { $pull: { billingViewers: target } };
  const saved = await ClientChannelModel.findByIdAndUpdate(client._id, update, { new: true }).select('billingViewers').lean<Pick<ClientChannel, 'billingViewers'> | null>();
  return wire(saved?.billingViewers);
}

/** Who sees money and who is restricted in a client's channel (José 30/10 night), for its admins. */
export async function listClientAccess(workspaceId: string, clientId: string, userId: Types.ObjectId): Promise<AccessList> {
  return accessWire(await clientForAdmin(workspaceId, clientId, userId));
}

const withoutMember = (entries: readonly RestrictedMember[], target: Types.ObjectId) => entries.filter((entry) => !entry.userId.equals(target));

/** `money` marks who sees amounts; `restricted` limits the member to some tabs and stages, `null` lifts it. */
export async function setClientAccess(workspaceId: string, clientId: string, userId: Types.ObjectId, targetId: string, body: { money?: unknown; restricted?: unknown }): Promise<AccessList> {
  const client = await clientForAdmin(workspaceId, clientId, userId);
  const target = await memberOfChannel(client, targetId);
  const set: Partial<Pick<ClientChannel, 'billingViewers' | 'restrictedMembers'>> = {};
  if (typeof body.money === 'boolean') set.billingViewers = body.money ? [...(client.billingViewers ?? []).filter((one) => !one.equals(target)), target] : (client.billingViewers ?? []).filter((one) => !one.equals(target));
  if (body.restricted === null) set.restrictedMembers = withoutMember(client.restrictedMembers ?? [], target);
  if (body.restricted !== undefined && body.restricted !== null) {
    const parsed = memberAccessOf(body.restricted);
    if (!parsed.ok) throw new WorkspaceError(400, parsed.message);
    if (await isSpaceAdmin(client.workspaceId, target)) throw new WorkspaceError(400, ADMIN_SEES_ALL);
    set.restrictedMembers = [...withoutMember(client.restrictedMembers ?? [], target), { userId: target, ...parsed.access }];
  }
  const saved = await ClientChannelModel.findByIdAndUpdate(client._id, { $set: set }, { new: true }).select('billingViewers restrictedMembers').lean<Pick<ClientChannel, 'billingViewers' | 'restrictedMembers'> | null>();
  return accessWire({ ...client, ...(saved ?? {}) });
}

type JoinAccess = { ok: true; save: (() => Promise<void>) | null } | { ok: false; status: 400 | 403; message: string };

/**
 * Adding someone to a client's channel with `access` (José 30/10 night: «con
 * accesos restringidos»): checked BEFORE adding, saved right after. Only a
 * space admin limits, and never another admin.
 */
export async function joinAccessOf(chatId: string, adderId: Types.ObjectId, targetId: string, raw: unknown): Promise<JoinAccess> {
  if (raw === undefined || raw === null) return { ok: true, save: null };
  const parsed = memberAccessOf(raw);
  if (!parsed.ok) return { ok: false, status: 400, message: parsed.message };
  const client = Types.ObjectId.isValid(chatId) ? await ClientChannelModel.findOne({ chatId: new Types.ObjectId(chatId) }).select('workspaceId').lean<Pick<ClientChannel, '_id' | 'workspaceId'> | null>() : null;
  if (!client) return { ok: false, status: 400, message: 'El acceso restringido es de los canales de cliente.' };
  if (!(await isSpaceAdmin(client.workspaceId, adderId))) return { ok: false, status: 403, message: 'Solo un admin del espacio limita accesos.' };
  const target = new Types.ObjectId(targetId);
  if (await isSpaceAdmin(client.workspaceId, target)) return { ok: false, status: 400, message: ADMIN_SEES_ALL };
  const save = async () => {
    await ClientChannelModel.updateOne({ _id: client._id }, { $pull: { restrictedMembers: { userId: target } } });
    await ClientChannelModel.updateOne({ _id: client._id }, { $push: { restrictedMembers: { userId: target, ...parsed.access } } });
  };
  return { ok: true, save };
}

/** A member promoted to admin sees every client channel whole again. */
export async function liftRestrictionsOfAdmin(workspaceId: string, memberId: string): Promise<void> {
  if (!Types.ObjectId.isValid(memberId)) return;
  const member = await WorkspaceMemberModel.findOne({ _id: new Types.ObjectId(memberId), workspaceId: new Types.ObjectId(workspaceId) }).select('role userId').lean();
  if (!member?.userId || !canManageMembers(member.role)) return;
  await ClientChannelModel.updateMany({ workspaceId: new Types.ObjectId(workspaceId), 'restrictedMembers.userId': member.userId }, { $pull: { restrictedMembers: { userId: member.userId } } });
}

import { model, Schema, Types } from 'mongoose';
import { archivedAgeGroup, archivedSince, CLIENT_ID, isClientChannelLive, validateClientState, type ClientService, type ClientState } from '@lilachat/shared';
import { ChatModel, MessageModel } from '../chatModels.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { noticeChannelJoined } from '../workspaceNotices.js';
import { actorIn } from '../workspaces.js';
import type { BotInstallation } from './botModels.js';

/**
 * A channel per client of the company (pending 21, §157). The app (agentes)
 * sends the client's state with `PUT /api/bots/clients/:clientId`; the first
 * time it creates a PRIVATE channel with the bot and the space's admins only
 * (José, 29/10); every later PUT adds an admin promoted since. Live or archived
 * is worked out from the state when read, never stored.
 */
export type ClientChannel = ClientState & { _id: Types.ObjectId; workspaceId: Types.ObjectId; appId: Types.ObjectId; clientId: string; chatId: Types.ObjectId; updatedAt: Date };
type Installation = Pick<BotInstallation, '_id' | 'appId' | 'workspaceId' | 'botUserId'>;
type ClientsError = { status: 400 | 404; error: string; message: string };

const serviceSchema = new Schema<ClientService>({ id: String, name: String, status: String, stage: String, stageLabel: String, progress: Number, url: String, closedAt: String }, { _id: false });
const clientChannelSchema = new Schema<ClientChannel>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    appId: { type: Schema.Types.ObjectId, required: true },
    clientId: { type: String, required: true },
    chatId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    ruc: { type: String },
    driveUrl: { type: String },
    lastActivityAt: { type: String, default: null },
    lastOrderAt: { type: String, default: null },
    ordersTotal: { type: Number, default: 0 },
    services: { type: [serviceSchema], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
clientChannelSchema.index({ workspaceId: 1, appId: 1, clientId: 1 }, { unique: true });
export const ClientChannelModel = model<ClientChannel>('ClientChannel', clientChannelSchema);

/** The space's client channels: the app's channel pickers and «Todos» leave them out (José, 30/10). */
export async function clientChatIdsOf(workspaceId: Types.ObjectId): Promise<Types.ObjectId[]> {
  return (await ClientChannelModel.find({ workspaceId }).select('chatId').lean()).map((one) => one.chatId);
}

export async function isClientChat(chatId: Types.ObjectId | string): Promise<boolean> {
  return Boolean(await ClientChannelModel.exists({ chatId }));
}

const fail = (status: ClientsError['status'], error: string, message: string): ClientsError => ({ status, error, message });
const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000;

function toWire(doc: Pick<ClientChannel, 'clientId' | 'chatId' | 'name' | 'lastActivityAt'>, now: Date) {
  const live = isClientChannelLive(doc, now);
  return { id: doc.clientId, channel: { id: String(doc.chatId), name: doc.name }, live, archived_since: live ? null : archivedSince(doc) };
}

async function spaceAdminIds(workspaceId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const admins = await WorkspaceMemberModel.find({ workspaceId, status: 'active', role: { $in: ['owner', 'admin'] } }).select('userId').lean();
  return admins.flatMap((admin) => (admin.userId ? [admin.userId] : []));
}

async function createClientChat(installation: Installation, name: string): Promise<{ chatId: Types.ObjectId; admins: Types.ObjectId[] }> {
  const admins = await spaceAdminIds(installation.workspaceId);
  const members = [{ userId: installation.botUserId, role: 'member' as const }, ...admins.map((userId) => ({ userId, role: 'admin' as const }))];
  const chat = await ChatModel.create({ kind: 'group', name, workspaceId: installation.workspaceId, channel: { visibility: 'private' }, members, lastSeq: 0 });
  return { chatId: chat._id, admins };
}

/** An admin promoted after the channel was born joins it with the next PUT. */
async function addMissingAdmins(installation: Installation, chatId: Types.ObjectId): Promise<void> {
  const chat = await ChatModel.findById(chatId).select('members.userId').lean();
  if (!chat) return;
  const inside = new Set(chat.members.map((member) => String(member.userId)));
  const missing = (await spaceAdminIds(installation.workspaceId)).filter((userId) => !inside.has(String(userId)));
  if (!missing.length) return;
  await ChatModel.updateOne({ _id: chatId }, { $push: { members: { $each: missing.map((userId) => ({ userId, role: 'admin' })) } } });
  missing.forEach((userId) => noticeChannelJoined(userId, chatId));
}

/** Creates the channel the first time (201) and keeps the state up to date (200); the same body twice changes nothing. */
export async function upsertClientChannel(installation: Installation, clientId: string, raw: unknown, now = new Date()): Promise<{ status: 200 | 201; client: ReturnType<typeof toWire> } | ClientsError> {
  if (!CLIENT_ID.test(clientId)) return fail(400, 'invalid_request', 'El id del cliente lleva letras, números, _ o -, hasta 64.');
  const valid = validateClientState(raw);
  if (!valid.ok) return fail(400, 'invalid_request', valid.message);
  const key = { workspaceId: installation.workspaceId, appId: installation.appId, clientId };
  const existing = await ClientChannelModel.findOne(key).lean<ClientChannel | null>();
  if (existing) {
    await ClientChannelModel.updateOne({ _id: existing._id }, { $set: valid.state });
    if (existing.name !== valid.state.name) await ChatModel.updateOne({ _id: existing.chatId }, { $set: { name: valid.state.name } });
    await addMissingAdmins(installation, existing.chatId);
    return { status: 200, client: toWire({ ...existing, ...valid.state }, now) };
  }
  const { chatId, admins } = await createClientChat(installation, valid.state.name);
  try {
    await ClientChannelModel.create({ ...key, chatId, ...valid.state });
  } catch (error) {
    // Two PUTs at once: the one that lost drops its chat and updates the winner's.
    if (!isDuplicateKey(error)) throw error;
    await ChatModel.deleteOne({ _id: chatId });
    return upsertClientChannel(installation, clientId, raw, now);
  }
  // Their devices read the space again and the channel shows without reloading (José, 30/10).
  admins.forEach((userId) => noticeChannelJoined(userId, chatId));
  return { status: 201, client: toWire({ clientId, chatId, ...valid.state }, now) };
}

/** The channel of a client of THIS app, for `target: { client }`. */
export async function chatOfClient(installation: Installation, clientId: string): Promise<Types.ObjectId | ClientsError> {
  const found = await ClientChannelModel.findOne({ workspaceId: installation.workspaceId, appId: installation.appId, clientId }).select('chatId').lean<Pick<ClientChannel, 'chatId'> | null>();
  return found?.chatId ?? fail(404, 'client_not_found', `Ese cliente no tiene canal: manda primero PUT /api/bots/clients/${clientId} con su estado.`);
}

/** The space's clients whose private channel this member is in (designs f-01/f-02): live first, then by last movement. */
export async function listClients(workspaceId: string, userId: Types.ObjectId, now = new Date()) {
  await actorIn(workspaceId, userId);
  const spaceId = new Types.ObjectId(workspaceId);
  const mine = await ChatModel.find({ workspaceId: spaceId, 'members.userId': userId }).select('_id').lean();
  const docs = await ClientChannelModel.find({ workspaceId: spaceId, chatId: { $in: mine.map((chat) => chat._id) } }).select('clientId chatId name ruc driveUrl lastActivityAt lastOrderAt ordersTotal services').lean<ClientChannel[]>();
  const clients = docs.map((doc) => ({
    ...toWire(doc, now),
    chat_id: String(doc.chatId),
    name: doc.name,
    ...(doc.ruc ? { ruc: doc.ruc } : {}),
    ...(doc.driveUrl ? { drive_url: doc.driveUrl } : {}),
    last_activity_at: doc.lastActivityAt,
    last_order_at: doc.lastOrderAt,
    orders_total: doc.ordersTotal,
    archived_group: archivedAgeGroup(doc.lastActivityAt, now),
    services: doc.services.map((one) => ({ id: one.id, name: one.name, status: one.status, stage_label: one.stageLabel, ...(one.progress !== undefined ? { progress: one.progress } : {}), ...(one.url ? { url: one.url } : {}) })),
  }));
  const lastActivity = (one: { last_activity_at: string | null }) => (one.last_activity_at ? Date.parse(one.last_activity_at) : 0);
  return clients.sort((a, b) => Number(b.live) - Number(a.live) || lastActivity(b) - lastActivity(a));
}

/** How many records «Servicios» shows per client: the newest ones. */
const MAX_RECORDS = 200;

/**
 * The records of a client's services (José, 29/10: «no veo los servicios,
 * informes»): the messages the app posted with `refs.service_id`, newest
 * first, for a member of the client's channel. Anyone else gets 404.
 */
export async function clientRecords(workspaceId: string, clientId: string, userId: Types.ObjectId) {
  await actorIn(workspaceId, userId);
  const notFound = fail(404, 'client_not_found', 'Ese cliente no existe o no estás en su canal.');
  const found = await ClientChannelModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), clientId }).select('chatId').lean<Pick<ClientChannel, 'chatId'> | null>();
  if (!found || !(await ChatModel.exists({ _id: found.chatId, 'members.userId': userId }))) return notFound;
  const messages = await MessageModel.find({ chatId: found.chatId, 'clientRef.serviceId': { $exists: true }, deletedAt: { $exists: false } })
    .sort({ seq: -1 })
    .limit(MAX_RECORDS)
    .select('seq at body card.title card.kicker clientRef')
    .lean();
  return {
    records: messages.map((message) => ({
      seq: message.seq,
      at: message.at,
      kind: message.clientRef?.kind,
      service_id: message.clientRef?.serviceId,
      ...(message.clientRef?.recordId ? { record_id: message.clientRef.recordId } : {}),
      title: message.card?.title ?? message.body ?? '',
      ...(message.card?.kicker ? { kicker: message.card.kicker } : {}),
    })),
  };
}

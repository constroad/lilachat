import { model, Schema, Types } from 'mongoose';
import { archivedAgeGroup, archivedSince, CLIENT_ID, isClientChannelLive, validateClientState, type ClientService, type ClientState } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { actorIn } from '../workspaces.js';
import type { BotInstallation } from './botModels.js';

/**
 * A channel per client of the company (pending 21, §157). The app (agentes)
 * sends the client's state with `PUT /api/bots/clients/:clientId`; the first
 * time it creates a public channel with the bot and the space's admins (the
 * rest join from «Explorar canales»). Live or archived is worked out from the
 * state when read, never stored.
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
    lastOrderAt: { type: String, default: null },
    ordersTotal: { type: Number, default: 0 },
    services: { type: [serviceSchema], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
clientChannelSchema.index({ workspaceId: 1, appId: 1, clientId: 1 }, { unique: true });
export const ClientChannelModel = model<ClientChannel>('ClientChannel', clientChannelSchema);

const fail = (status: ClientsError['status'], error: string, message: string): ClientsError => ({ status, error, message });
const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000;

function toWire(doc: Pick<ClientChannel, 'clientId' | 'chatId' | 'name' | 'lastOrderAt' | 'services'>, now: Date) {
  const live = isClientChannelLive(doc, now);
  return { id: doc.clientId, channel: { id: String(doc.chatId), name: doc.name }, live, archived_since: live ? null : archivedSince(doc) };
}

async function createClientChat(installation: Installation, name: string): Promise<Types.ObjectId> {
  const admins = await WorkspaceMemberModel.find({ workspaceId: installation.workspaceId, status: 'active', role: { $in: ['owner', 'admin'] } }).select('userId').lean();
  const members = [{ userId: installation.botUserId, role: 'member' as const }, ...admins.flatMap((admin) => (admin.userId ? [{ userId: admin.userId, role: 'admin' as const }] : []))];
  const chat = await ChatModel.create({ kind: 'group', name, workspaceId: installation.workspaceId, channel: { visibility: 'public' }, members, lastSeq: 0 });
  return chat._id;
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
    return { status: 200, client: toWire({ ...existing, ...valid.state }, now) };
  }
  const chatId = await createClientChat(installation, valid.state.name);
  try {
    await ClientChannelModel.create({ ...key, chatId, ...valid.state });
  } catch (error) {
    // Two PUTs at once: the one that lost drops its chat and updates the winner's.
    if (!isDuplicateKey(error)) throw error;
    await ChatModel.deleteOne({ _id: chatId });
    return upsertClientChannel(installation, clientId, raw, now);
  }
  return { status: 201, client: toWire({ clientId, chatId, ...valid.state }, now) };
}

/** The channel of a client of THIS app, for `target: { client }`. */
export async function chatOfClient(installation: Installation, clientId: string): Promise<Types.ObjectId | ClientsError> {
  const found = await ClientChannelModel.findOne({ workspaceId: installation.workspaceId, appId: installation.appId, clientId }).select('chatId').lean<Pick<ClientChannel, 'chatId'> | null>();
  return found?.chatId ?? fail(404, 'client_not_found', `Ese cliente no tiene canal: manda primero PUT /api/bots/clients/${clientId} con su estado.`);
}

/** The space's clients for any active member (designs f-01/f-02): live first, then by last order. */
export async function listClients(workspaceId: string, userId: Types.ObjectId, now = new Date()) {
  await actorIn(workspaceId, userId);
  const docs = await ClientChannelModel.find({ workspaceId: new Types.ObjectId(workspaceId) }).select('clientId chatId name ruc lastOrderAt ordersTotal services').lean<ClientChannel[]>();
  const clients = docs.map((doc) => ({
    ...toWire(doc, now),
    chat_id: String(doc.chatId),
    name: doc.name,
    ...(doc.ruc ? { ruc: doc.ruc } : {}),
    last_order_at: doc.lastOrderAt,
    orders_total: doc.ordersTotal,
    archived_group: archivedAgeGroup(doc.lastOrderAt, now),
    services: doc.services.map((one) => ({ id: one.id, name: one.name, status: one.status, stage_label: one.stageLabel, ...(one.progress !== undefined ? { progress: one.progress } : {}), ...(one.url ? { url: one.url } : {}) })),
  }));
  const lastOrder = (one: { last_order_at: string | null }) => (one.last_order_at ? Date.parse(one.last_order_at) : 0);
  return clients.sort((a, b) => Number(b.live) - Number(a.live) || lastOrder(b) - lastOrder(a));
}

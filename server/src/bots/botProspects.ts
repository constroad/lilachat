import { model, Schema, Types } from 'mongoose';
import { PROSPECT_ID, PROSPECTS_SCOPE, prospectChannelName, shownProspectPhone, validateProspectState, type ProspectAuthor, type ProspectState } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { noticeChannelJoined } from '../workspaceNotices.js';
import type { BotInstallation } from './botModels.js';

/**
 * Dali's prospects (BOTS-API §c-prospectos, José via agentes 16/11): one PRIVATE channel per person who
 * wrote from a paid click-to-WhatsApp ad, with the bot and every active member of the «Dali · <empresa>»
 * space (all of them see it, with the full number to call). agentes keeps the id; Lilachat the channel.
 */
export type ProspectChannel = ProspectState & { _id: Types.ObjectId; workspaceId: Types.ObjectId; appId: Types.ObjectId; prospectId: string; chatId: Types.ObjectId };
type Installation = Pick<BotInstallation, '_id' | 'appId' | 'workspaceId' | 'botUserId' | 'grantedScopes'>;
type ProspectsError = { status: 400 | 403 | 404; error: string; message: string };

const sourceSchema = new Schema({ kind: String, adId: String, adTitle: String, adUrl: String }, { _id: false });
const prospectSchema = new Schema<ProspectChannel>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    appId: { type: Schema.Types.ObjectId, required: true },
    prospectId: { type: String, required: true },
    chatId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String },
    phone: { type: String, required: true },
    lastActivityAt: { type: String, required: true },
    attendedBy: { type: String, enum: ['dali', 'human'], default: 'dali' },
    source: { type: sourceSchema, default: undefined },
  },
  { timestamps: true },
);
prospectSchema.index({ workspaceId: 1, appId: 1, prospectId: 1 }, { unique: true });
export const ProspectChannelModel = model<ProspectChannel>('ProspectChannel', prospectSchema);

const fail = (status: ProspectsError['status'], error: string, message: string): ProspectsError => ({ status, error, message });
const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000;
const NOT_GRANTED = fail(403, 'missing_scope', `La instalación no aceptó ${PROSPECTS_SCOPE}: un admin tiene que tocar «Reinstalar».`);
const toWire = (doc: Pick<ProspectChannel, 'prospectId' | 'chatId' | 'attendedBy'>, name: string) => ({ id: doc.prospectId, channel: { id: String(doc.chatId), name }, attended_by: doc.attendedBy });

async function activeMemberIds(workspaceId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const members = await WorkspaceMemberModel.find({ workspaceId, status: 'active' }).select('userId').lean();
  return members.flatMap((member) => (member.userId ? [member.userId] : []));
}

/** A member who joined the space after the channel was born enters with the next PUT. */
async function addMissingMembers(installation: Installation, chatId: Types.ObjectId): Promise<void> {
  const chat = await ChatModel.findById(chatId).select('members.userId').lean();
  if (!chat) return;
  const inside = new Set(chat.members.map((member) => String(member.userId)));
  const missing = (await activeMemberIds(installation.workspaceId)).filter((userId) => !inside.has(String(userId)));
  if (!missing.length) return;
  await ChatModel.updateOne({ _id: chatId }, { $push: { members: { $each: missing.map((userId) => ({ userId, role: 'member' })) } } });
  missing.forEach((userId) => noticeChannelJoined(userId, chatId));
}

async function createProspectChat(installation: Installation, prospectId: string, name: string): Promise<{ chatId: Types.ObjectId; members: Types.ObjectId[] }> {
  const members = await activeMemberIds(installation.workspaceId);
  const chat = await ChatModel.create({
    kind: 'group',
    name,
    workspaceId: installation.workspaceId,
    channel: { visibility: 'private' },
    prospectId,
    members: [{ userId: installation.botUserId, role: 'member' }, ...members.map((userId) => ({ userId, role: 'member' as const }))],
    lastSeq: 0,
  });
  return { chatId: chat._id, members };
}

/** Creates the prospect's channel the first time (201) and keeps its state (200). */
export async function upsertProspectChannel(installation: Installation, prospectId: string, raw: unknown): Promise<{ status: 200 | 201; prospect: ReturnType<typeof toWire> } | ProspectsError> {
  if (!installation.grantedScopes?.includes(PROSPECTS_SCOPE)) return NOT_GRANTED;
  if (!PROSPECT_ID.test(prospectId)) return fail(400, 'invalid_request', 'El id del prospecto lleva letras, números, :, _ o -, hasta 120.');
  const valid = validateProspectState(raw);
  if (!valid.ok) return fail(400, 'invalid_request', valid.message);
  const name = prospectChannelName(valid.state);
  const key = { workspaceId: installation.workspaceId, appId: installation.appId, prospectId };
  const existing = await ProspectChannelModel.findOne(key).lean<ProspectChannel | null>();
  if (existing) {
    await ProspectChannelModel.updateOne({ _id: existing._id }, { $set: valid.state, ...(valid.state.name ? {} : { $unset: { name: 1 } }) });
    await ChatModel.updateOne({ _id: existing.chatId }, { $set: { name } });
    await addMissingMembers(installation, existing.chatId);
    return { status: 200, prospect: toWire({ ...existing, ...valid.state }, name) };
  }
  const { chatId, members } = await createProspectChat(installation, prospectId, name);
  try {
    await ProspectChannelModel.create({ ...key, chatId, ...valid.state });
  } catch (error) {
    // Two PUTs at once: the one that lost drops its chat and updates the winner's.
    if (!isDuplicateKey(error)) throw error;
    await ChatModel.deleteOne({ _id: chatId });
    return upsertProspectChannel(installation, prospectId, raw);
  }
  members.forEach((userId) => noticeChannelJoined(userId, chatId));
  return { status: 201, prospect: toWire({ prospectId, chatId, attendedBy: valid.state.attendedBy }, name) };
}

/** The channel of a prospect of THIS app, and who they are for `as_contact`. */
export async function chatOfProspect(installation: Pick<Installation, 'workspaceId' | 'appId'>, prospectId: string): Promise<{ chatId: Types.ObjectId; author: ProspectAuthor } | ProspectsError> {
  const found = await ProspectChannelModel.findOne({ workspaceId: installation.workspaceId, appId: installation.appId, prospectId }).lean<ProspectChannel | null>();
  if (!found) return fail(404, 'prospect_not_found', `Ese prospecto no tiene canal: manda primero PUT /api/bots/prospects/${prospectId}.`);
  const author: ProspectAuthor = { name: found.name ?? shownProspectPhone(found.phone), phone: found.phone, ...(found.source?.adTitle ? { adTitle: found.source.adTitle } : {}) };
  return { chatId: found.chatId, author };
}

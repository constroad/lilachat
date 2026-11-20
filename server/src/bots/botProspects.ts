import { model, Schema, Types } from 'mongoose';
import { keepConfirmedFields, PROSPECT_ID, PROSPECTS_SCOPE, prospectChannelName, shownProspectPhone, validateProspectInsight, validateProspectState, type IgnoredField, type LossReason, type NextActionKind, type ProspectAuthor, type ProspectInsight, type ProspectOutcome, type ProspectState } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { noticeChannelJoined } from '../workspaceNotices.js';
import type { BotInstallation } from './botModels.js';
import { botOfUser } from './botRegistry.js';
import { announceProspects } from './prospectAnnounce.js';

/**
 * Dali's prospects (BOTS-API §c-prospectos, José via agentes 16/11): one PRIVATE channel per person who
 * wrote from a paid click-to-WhatsApp ad, with the bot and every active member of the «Dali · <empresa>»
 * space (all of them see it, with the full number to call). agentes keeps the id; Lilachat the channel.
 * Phase 2 («Fase 2: contrato»): the same PUT brings what Dali knows (absent = unchanged, null = cleared);
 * what the sellers decide lives here too, with a `version` that grows on each of their changes.
 */
export type ProspectSellerState = {
  assignee?: { userId: Types.ObjectId; name: string };
  nextAction?: { kind: NextActionKind; at: Date; assigneeId: Types.ObjectId; note?: string; reminderId?: Types.ObjectId };
  result?: { outcome: ProspectOutcome; reason?: LossReason; note?: string; at: Date; userId: Types.ObjectId; name: string };
  version: number;
};
/** When the prospect wrote, and when Dali and a person answered: the panel's first answer and the inbox's 15 min. */
export type ProspectTiming = { firstContactAt?: Date; lastContactAt?: Date; firstDaliReplyAt?: Date; firstTeamReply?: { at: Date; userId: Types.ObjectId }; lastTeamReplyAt?: Date };
export type ProspectChannel = ProspectState & ProspectInsight & ProspectSellerState & ProspectTiming & { _id: Types.ObjectId; workspaceId: Types.ObjectId; appId: Types.ObjectId; prospectId: string; chatId: Types.ObjectId; createdAt: Date; updatedAt: Date };
type Installation = Pick<BotInstallation, '_id' | 'appId' | 'workspaceId' | 'botUserId' | 'grantedScopes'>;
type ProspectsError = { status: 400 | 403 | 404; error: string; message: string };

const loose = { _id: false } as const;
const sourceSchema = new Schema({ kind: String, adId: String, adTitle: String, adUrl: String, platform: { type: String, enum: ['instagram', 'facebook'] } }, loose);
const serviceSchema = new Schema({ key: String, name: String }, loose);
const confirmerSchema = new Schema({ id: String, name: String, at: String }, loose);
// geo is validated by the shared reader (points and a polygon of up to 500 vertices); Mixed keeps it as it came.
const fieldSchema = new Schema({ key: String, label: String, value: String, source: String, fileId: String, confirmed: Boolean, confirmedBy: confirmerSchema, geo: Schema.Types.Mixed }, loose);
const draftSchema = new Schema({ text: String, forAt: String }, loose);
const quoteSchema = new Schema({ code: String, amount: Number, currency: String, sentAt: String, url: String }, loose);
const questionSchema = new Schema({ question: String, at: String }, loose);
const assigneeSchema = new Schema({ userId: Schema.Types.ObjectId, name: String }, loose);
const nextActionSchema = new Schema({ kind: String, at: Date, assigneeId: Schema.Types.ObjectId, note: String, reminderId: Schema.Types.ObjectId }, loose);
const resultSchema = new Schema({ outcome: String, reason: String, note: String, at: Date, userId: Schema.Types.ObjectId, name: String }, loose);
const teamReplySchema = new Schema({ at: Date, userId: Schema.Types.ObjectId }, loose);
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
    // A direct 1:1 agentes marked as not a lead (José 20/11): absent reads as 'prospect' everywhere.
    listing: { type: String, enum: ['prospect', 'chat'] },
    // What Dali knows (agentes, PUT).
    stage: { type: String },
    service: { type: serviceSchema, default: undefined },
    intent: { type: String },
    score: { type: Number },
    scoreReasons: { type: [String], default: undefined },
    fields: { type: [fieldSchema], default: undefined },
    missing: { type: [String], default: undefined },
    readyAt: { type: String },
    kind: { type: String },
    summary: { type: String },
    followUpDraft: { type: draftSchema, default: undefined },
    quote: { type: quoteSchema, default: undefined },
    unanswered: { type: [questionSchema], default: undefined },
    // What the sellers decide (Lilachat).
    assignee: { type: assigneeSchema, default: undefined },
    nextAction: { type: nextActionSchema, default: undefined },
    result: { type: resultSchema, default: undefined },
    version: { type: Number, default: 0 },
    // When each side wrote (Lilachat, from the channel's messages).
    firstContactAt: { type: Date },
    lastContactAt: { type: Date },
    firstDaliReplyAt: { type: Date },
    firstTeamReply: { type: teamReplySchema, default: undefined },
    lastTeamReplyAt: { type: Date },
  },
  { timestamps: true },
);
prospectSchema.index({ workspaceId: 1, appId: 1, prospectId: 1 }, { unique: true });
prospectSchema.index({ workspaceId: 1, lastActivityAt: -1 });
prospectSchema.index({ chatId: 1 });
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

/** Phase 1 sends the whole state (no name = no name); phase 2 fields change only when they come. */
function updateOf(state: ProspectState, insight: { set: ProspectInsight; unset: (keyof ProspectInsight)[] }) {
  const unset: Record<string, 1> = Object.fromEntries(insight.unset.map((key) => [key, 1 as const]));
  if (!state.name) unset.name = 1;
  return { $set: { ...state, ...insight.set }, ...(Object.keys(unset).length ? { $unset: unset } : {}) };
}

/** A field a seller confirmed in the ficha survives Dali's next PUT (fase 3) unless Dali sends it confirmed. */
function keptConfirmed(patch: ReturnType<typeof validateProspectInsight>['patch'], existing: ProspectChannel) {
  if (!patch.set.fields) return patch;
  return { ...patch, set: { ...patch.set, fields: keepConfirmedFields(patch.set.fields, existing.fields) } };
}

/** Creates the prospect's channel the first time (201) and keeps its state (200). */
export async function upsertProspectChannel(installation: Installation, prospectId: string, raw: unknown): Promise<{ status: 200 | 201; prospect: ReturnType<typeof toWire>; ignored?: IgnoredField[] } | ProspectsError> {
  if (!installation.grantedScopes?.includes(PROSPECTS_SCOPE)) return NOT_GRANTED;
  if (!PROSPECT_ID.test(prospectId)) return fail(400, 'invalid_request', 'El id del prospecto lleva letras, números, :, _ o -, hasta 120.');
  const valid = validateProspectState(raw);
  if (!valid.ok) return fail(400, 'invalid_request', valid.message);
  const insight = validateProspectInsight(raw);
  if (insight.ignored.length) console.warn(`[prospectos] ${prospectId}: campos ignorados del PUT: ${insight.ignored.map((one) => one.field).join(', ')}`);
  const ignored = insight.ignored.length ? { ignored: insight.ignored } : {};
  const name = prospectChannelName(valid.state);
  const key = { workspaceId: installation.workspaceId, appId: installation.appId, prospectId };
  const existing = await ProspectChannelModel.findOne(key).lean<ProspectChannel | null>();
  if (existing) {
    await ProspectChannelModel.updateOne({ _id: existing._id }, updateOf(valid.state, keptConfirmed(insight.patch, existing)));
    await ChatModel.updateOne({ _id: existing.chatId }, { $set: { name } });
    await addMissingMembers(installation, existing.chatId);
    announceProspects(installation.workspaceId);
    return { status: 200, prospect: toWire({ ...existing, ...valid.state }, name), ...ignored };
  }
  const { chatId, members } = await createProspectChat(installation, prospectId, name);
  try {
    await ProspectChannelModel.create({ ...key, chatId, ...valid.state, ...insight.patch.set });
  } catch (error) {
    // Two PUTs at once: the one that lost drops its chat and updates the winner's.
    if (!isDuplicateKey(error)) throw error;
    await ChatModel.deleteOne({ _id: chatId });
    return upsertProspectChannel(installation, prospectId, raw);
  }
  members.forEach((userId) => noticeChannelJoined(userId, chatId));
  announceProspects(installation.workspaceId);
  return { status: 201, prospect: toWire({ prospectId, chatId, attendedBy: valid.state.attendedBy }, name), ...ignored };
}

/** The channel of a prospect of THIS app, and who they are for `as_contact`. */
export async function chatOfProspect(installation: Pick<Installation, 'workspaceId' | 'appId'>, prospectId: string): Promise<{ chatId: Types.ObjectId; author: ProspectAuthor } | ProspectsError> {
  const found = await ProspectChannelModel.findOne({ workspaceId: installation.workspaceId, appId: installation.appId, prospectId }).lean<ProspectChannel | null>();
  if (!found) return fail(404, 'prospect_not_found', `Ese prospecto no tiene canal: manda primero PUT /api/bots/prospects/${prospectId}.`);
  const author: ProspectAuthor = { name: found.name ?? shownProspectPhone(found.phone), phone: found.phone, ...(found.source?.adTitle ? { adTitle: found.source.adTitle } : {}) };
  return { chatId: found.chatId, author };
}

const logTiming = (error: unknown) => console.error('[prospectos] no se pudo anotar la hora:', error instanceof Error ? error.message : error);

/** What Dali posted in a prospect's channel: the prospect's own words (`as_contact`), or Dali answering. */
export function noteDaliPost(chatId: Types.ObjectId, post: { asContact?: { sentAt?: string }; threadOf?: number }): void {
  if (post.threadOf) return;
  const at = new Date(post.asContact?.sentAt ?? Date.now());
  const update = post.asContact
    ? ProspectChannelModel.updateOne({ chatId }, { $min: { firstContactAt: at }, $max: { lastContactAt: at } })
    : ProspectChannelModel.updateOne({ chatId, firstDaliReplyAt: { $exists: false }, firstContactAt: { $lte: at } }, { $set: { firstDaliReplyAt: at } });
  void update.catch(logTiming);
}

/** A person answered in the channel itself (a thread stays in the team): the first one, and the last time. */
export async function noteTeamReply(message: { chatId: Types.ObjectId | string; senderId: Types.ObjectId | string; hiloDe?: number | null; at?: Date }): Promise<void> {
  if (message.hiloDe || (await botOfUser(String(message.senderId)))) return;
  const chatId = new Types.ObjectId(String(message.chatId));
  const at = message.at ?? new Date();
  await ProspectChannelModel.updateOne({ chatId }, { $max: { lastTeamReplyAt: at } });
  // The first answer moves the prospect out of «Atender ahora»: the inbox hears it. Later ones only touch the hour.
  const first = await ProspectChannelModel.findOneAndUpdate({ chatId, firstTeamReply: { $exists: false } }, { $set: { firstTeamReply: { at, userId: new Types.ObjectId(String(message.senderId)) } } }, { projection: { workspaceId: 1 } }).lean();
  if (first) announceProspects(first.workspaceId);
}

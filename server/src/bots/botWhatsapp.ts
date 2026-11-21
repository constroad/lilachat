import { model, Schema, Types } from 'mongoose';
import { WHATSAPP_ID } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { noticeChannelJoined } from '../workspaceNotices.js';
import type { BotInstallation } from './botModels.js';

/**
 * A WhatsApp group mirrored into Dali's Chats tab (fase 1, agentes 20/11): `PUT /api/bots/whatsapp/:waId`
 * creates a PRIVATE channel with the bot and every active member of the space (José: visible a todo el
 * espacio, igual que un prospecto). Unlike a prospect or a client, this channel has NO fixed author — a
 * group has many possible senders, so each message carries its own `as_contact` instead.
 */
export type WhatsappChannel = { _id: Types.ObjectId; workspaceId: Types.ObjectId; appId: Types.ObjectId; waId: string; chatId: Types.ObjectId; title: string; isGroup: boolean; updatedAt: Date };
type Installation = Pick<BotInstallation, '_id' | 'appId' | 'workspaceId' | 'botUserId'>;
type WhatsappError = { status: 400 | 404; error: string; message: string };
const TITLE_MAX = 120;

const whatsappChannelSchema = new Schema<WhatsappChannel>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    appId: { type: Schema.Types.ObjectId, required: true },
    waId: { type: String, required: true },
    chatId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    isGroup: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
whatsappChannelSchema.index({ workspaceId: 1, appId: 1, waId: 1 }, { unique: true });
export const WhatsappChannelModel = model<WhatsappChannel>('WhatsappChannel', whatsappChannelSchema);

/** The space's WhatsApp channels: Dali's Chats tab sections them apart from direct chats. */
export async function whatsappChatIdsOf(workspaceId: Types.ObjectId): Promise<Types.ObjectId[]> {
  return (await WhatsappChannelModel.find({ workspaceId }).select('chatId').lean()).map((one) => one.chatId);
}

const fail = (status: WhatsappError['status'], error: string, message: string): WhatsappError => ({ status, error, message });
const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000;

function toWire(doc: Pick<WhatsappChannel, 'waId' | 'chatId' | 'title'>) {
  return { whatsapp_id: doc.waId, channel: { id: String(doc.chatId), name: doc.title } };
}

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

async function createWhatsappChat(installation: Installation, waId: string, title: string): Promise<{ chatId: Types.ObjectId; members: Types.ObjectId[] }> {
  const members = await activeMemberIds(installation.workspaceId);
  const chat = await ChatModel.create({
    kind: 'group',
    name: title,
    workspaceId: installation.workspaceId,
    channel: { visibility: 'private' },
    whatsappId: waId,
    members: [{ userId: installation.botUserId, role: 'member' }, ...members.map((userId) => ({ userId, role: 'member' as const }))],
    lastSeq: 0,
  });
  return { chatId: chat._id, members };
}

/** Creates the group's channel the first time (201); a later PUT renames it and adds whoever joined since (200). */
export async function upsertWhatsappChannel(installation: Installation, waId: string, raw: unknown): Promise<{ status: 200 | 201; whatsapp: ReturnType<typeof toWire> } | WhatsappError> {
  if (!WHATSAPP_ID.test(waId)) return fail(400, 'invalid_request', 'whatsapp_id es el jid del chat o grupo de WhatsApp.');
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, TITLE_MAX) : '';
  if (!title) return fail(400, 'invalid_request', 'title es obligatorio.');
  const isGroup = body.is_group !== false;
  const key = { workspaceId: installation.workspaceId, appId: installation.appId, waId };
  const existing = await WhatsappChannelModel.findOne(key).lean<WhatsappChannel | null>();
  if (existing) {
    if (existing.title !== title) {
      await WhatsappChannelModel.updateOne({ _id: existing._id }, { $set: { title } });
      await ChatModel.updateOne({ _id: existing.chatId }, { $set: { name: title } });
    }
    await addMissingMembers(installation, existing.chatId);
    return { status: 200, whatsapp: toWire({ ...existing, title }) };
  }
  const { chatId, members } = await createWhatsappChat(installation, waId, title);
  try {
    await WhatsappChannelModel.create({ ...key, chatId, title, isGroup });
  } catch (error) {
    // Two PUTs at once: the one that lost drops its chat and updates the winner's.
    if (!isDuplicateKey(error)) throw error;
    await ChatModel.deleteOne({ _id: chatId });
    return upsertWhatsappChannel(installation, waId, raw);
  }
  members.forEach((userId) => noticeChannelJoined(userId, chatId));
  return { status: 201, whatsapp: toWire({ waId, chatId, title }) };
}

/** The channel of a WhatsApp chat of THIS app, for `target: { whatsapp }`. */
export async function chatOfWhatsapp(installation: Pick<Installation, 'workspaceId' | 'appId'>, waId: string): Promise<Types.ObjectId | WhatsappError> {
  const found = await WhatsappChannelModel.findOne({ workspaceId: installation.workspaceId, appId: installation.appId, waId }).select('chatId').lean<Pick<WhatsappChannel, 'chatId'> | null>();
  return found?.chatId ?? fail(404, 'whatsapp_not_found', `Ese chat de WhatsApp no tiene canal: manda primero PUT /api/bots/whatsapp/${waId}.`);
}

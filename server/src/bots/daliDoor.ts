import { Types } from 'mongoose';
import { embedLinkOf, INCOGNITO_COMPOSER, knowledgeViewOf, PROSPECTS_SCOPE, validateFaqAdd, type EmbedLink } from '@lilachat/shared';
import { MessageModel } from '../chatModels.js';
import { WorkspaceModel } from '../workspaceModels.js';
import { ProspectChannelModel } from './botProspects.js';
import { callBotWebhook, recordLastDelivery } from './botEvents.js';
import { BotAppModel, BotInstallationModel } from './botModels.js';
import { EMBED_ORIGINS } from './clientFiles.js';
import { memberOf, type DeskError, type Member } from './prospectDesk.js';

/**
 * Asking Dali (BOTS-API «Fase 2: contrato»): «Lo que Dali sabe» (dl-12) and «Enseñarle a Dali» (dl-13) are answered by
 * agentes on the spot, as a slash command is; the weekly review (dl-10) is Dali's card in the space's #general.
 */
const ASK_TIMEOUT_MS = 8_000;
const REVIEW_KEY_PREFIX = 'review:';
const fail = (status: DeskError['status'] | 502, error: string, message: string) => ({ status, error, message });
const UNREACHABLE = fail(502, 'dali_unreachable', 'Dali no respondió. Intenta de nuevo en un momento.');
const NOT_HERE = fail(404, 'not_found', 'Dali no está instalado en este espacio.');

type Door = { member: Member; installation: { _id: Types.ObjectId; workspaceId: Types.ObjectId; signingSecret: string; botUserId: Types.ObjectId }; webhookUrl: string };

/** The member asking, and the installation that has `prospects:write` here (Dali's). */
async function doorOf(workspaceId: string, userId: Types.ObjectId): Promise<Door | ReturnType<typeof fail>> {
  const member = await memberOf(workspaceId, userId);
  if (!member) return fail(404, 'not_found', 'Ese espacio no existe o ya no eres miembro.');
  const installation = await BotInstallationModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), grantedScopes: PROSPECTS_SCOPE, revokedAt: { $exists: false } }).select('_id workspaceId signingSecret botUserId appId').lean();
  const app = installation ? await BotAppModel.findById(installation.appId).select('webhookUrl').lean() : null;
  if (!installation || !app?.webhookUrl) return NOT_HERE;
  return { member, installation, webhookUrl: app.webhookUrl };
}

const asker = (member: Member) => ({ id: String(member.userId), name: member.name, ...(member.phone ? { phone: member.phone } : {}) });

/** What Dali knows, prices and price policy only for an admin. */
export async function daliKnowledge(workspaceId: string, userId: Types.ObjectId) {
  const door = await doorOf(workspaceId, userId);
  if ('error' in door) return door;
  const reply = await callBotWebhook({ ...door.installation, webhookUrl: door.webhookUrl }, 'dali.knowledge.requested', { user: asker(door.member) }, ASK_TIMEOUT_MS);
  const knowledge = reply.status === 200 ? knowledgeViewOf(reply.body, door.member.admin) : null;
  recordLastDelivery(door.installation._id, knowledge ? { ok: true } : { ok: false, error: reply.error ?? `HTTP ${reply.status}` });
  return knowledge ? { knowledge } : UNREACHABLE;
}

const faqIdOf = (body: unknown): string | null => {
  const faq = (body as { faq?: { id?: unknown } } | null)?.faq;
  return typeof faq?.id === 'string' && faq.id ? faq.id : null;
};

/** «Enseñarle a Dali»: ADDS one answer for this company; correcting or deleting it is done in agentes' panel. */
export async function teachDali(workspaceId: string, userId: Types.ObjectId, raw: unknown) {
  const valid = validateFaqAdd(raw);
  if (!valid.ok) return fail(400, 'invalid_request', valid.message);
  const door = await doorOf(workspaceId, userId);
  if ('error' in door) return door;
  if (door.member.hidden) return fail(403, 'incognito', INCOGNITO_COMPOSER);
  const data = { question: valid.faq.question, answer: valid.faq.answer, idempotency_key: valid.faq.idempotencyKey, user: asker(door.member) };
  const reply = await callBotWebhook({ ...door.installation, webhookUrl: door.webhookUrl }, 'dali.faq.add', data, ASK_TIMEOUT_MS);
  const id = reply.status === 200 ? faqIdOf(reply.body) : null;
  recordLastDelivery(door.installation._id, id ? { ok: true } : { ok: false, error: reply.error ?? `HTTP ${reply.status}` });
  return id ? { faq: { id } } : UNREACHABLE;
}

const QUOTE_ID = /^[a-f0-9]{24}$/i;
const QUOTE_EMBED_FAILED = 'No se pudo abrir el editor de la cotización.';
const QUOTE_GONE = 'Esta cotización ya no está en el Portal.';
const codeOf = (body: unknown): string | null => {
  const code = (body as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
};

/** «Editar» on a quote's card (José via agentes 20/11): Portal's editor framed in Lilachat, same mechanism as a report's embed. */
export async function quoteEmbed(workspaceId: string, chatId: string, quoteId: string, userId: Types.ObjectId): Promise<{ embed: EmbedLink } | ReturnType<typeof fail>> {
  if (!Types.ObjectId.isValid(chatId) || !QUOTE_ID.test(quoteId)) return fail(404, 'not_found', 'Esa cotización no existe.');
  const door = await doorOf(workspaceId, userId);
  if ('error' in door) return door;
  const channel = await ProspectChannelModel.findOne({ workspaceId: door.installation.workspaceId, chatId: new Types.ObjectId(chatId) }).select('prospectId').lean();
  if (!channel) return fail(404, 'not_found', 'Ese prospecto ya no existe en este espacio.');
  const reply = await callBotWebhook({ ...door.installation, webhookUrl: door.webhookUrl }, 'quote.embed.requested', { quote_id: quoteId, prospect_id: channel.prospectId, user: asker(door.member) }, ASK_TIMEOUT_MS);
  const embed = reply.status === 200 ? embedLinkOf(reply.body, EMBED_ORIGINS, 'quote') : null;
  recordLastDelivery(door.installation._id, embed ? { ok: true } : { ok: false, error: reply.error ?? `HTTP ${reply.status}` });
  if (embed) return { embed };
  if (reply.status === 400 && codeOf(reply.body) === 'denied') return fail(403, 'forbidden', 'Solo los administradores del espacio editan cotizaciones aquí.');
  if (reply.status === 404 && codeOf(reply.body) === 'not-found') return fail(404, 'not_found', QUOTE_GONE);
  return fail(502, 'dali_unreachable', QUOTE_EMBED_FAILED);
}

/** The latest weekly review Dali published in #general (`idempotency_key` `review:<AAAA-Www>`), or none yet. */
export async function latestReview(workspaceId: string, userId: Types.ObjectId) {
  const door = await doorOf(workspaceId, userId);
  if ('error' in door) return door;
  const space = await WorkspaceModel.findById(workspaceId).select('generalChatId').lean();
  if (!space?.generalChatId) return { review: null };
  const prefix = `bot:${door.installation._id}:${REVIEW_KEY_PREFIX}`;
  const message = await MessageModel.findOne({ chatId: space.generalChatId, senderId: door.installation.botUserId, clientKey: { $regex: `^${prefix}` }, deletedAt: { $exists: false } })
    .sort({ seq: -1 })
    .select('seq at card')
    .lean();
  return { review: message ? { chatId: String(space.generalChatId), seq: message.seq, at: message.at, ...(message.card ? { card: message.card } : {}) } : null };
}

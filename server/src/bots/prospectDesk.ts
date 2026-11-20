import { Types } from 'mongoose';
import { canManageMembers, INCOGNITO_COMPOSER, NEXT_ACTION_LABEL, PROSPECTS_SCOPE, prospectNameOf, validateSellerChange, type ProspectDocument, type ProspectField, type ProspectView, type SellerChange, validateFieldConfirmation } from '@lilachat/shared';
import { MessageModel } from '../chatModels.js';
import { toAbsoluteMediaUrl } from '../mediaClient.js';
import { ReminderModel } from '../eventModels.js';
import { UserModel } from '../models.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { sendBotEvent, type BotEventType } from './botEvents.js';
import { BotInstallationModel } from './botModels.js';
import { ProspectChannelModel, type ProspectChannel } from './botProspects.js';
import { announceProspects } from './prospectAnnounce.js';

/**
 * What the members of a Dali space do with its prospects (BOTS-API «Fase 2: contrato», dl-01 to dl-11): read them
 * (money only for admins), take one, plan the next action (a reminder in the Agenda), mark the result, approve the
 * follow-up Dali drafted and hand the prospect back to Dali. Each change grows `version` and tells agentes.
 */
export type DeskError = { status: 400 | 403 | 404 | 409; error: string; message: string; prospect?: ProspectView };
export type Member = { userId: Types.ObjectId; name: string; phone?: string; admin: boolean; hidden: boolean };
type Change = { $set: Record<string, unknown>; $unset: Record<string, 1>; remind: boolean };

const DAY_MS = 24 * 60 * 60_000;
const SINCE_DEFAULT_DAYS = 31;
const SINCE_MAX_DAYS = 400;
const LIST_MAX = 1000;
const FOLLOW_UP_MAX = 1000;

const fail = (status: DeskError['status'], error: string, message: string): DeskError => ({ status, error, message });
const NOT_FOUND = fail(404, 'not_found', 'Ese prospecto no existe en este espacio.');
const NOT_MEMBER = fail(404, 'not_found', 'Ese espacio no existe o ya no eres miembro.');
const iso = (date: Date | undefined): string | undefined => (date ? new Date(date).toISOString() : undefined);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** An active member of the space, with what they may see (money) and do (not while hidden). */
export async function memberOf(workspaceId: string, userId: Types.ObjectId): Promise<Member | null> {
  if (!Types.ObjectId.isValid(workspaceId)) return null;
  const [member, user] = await Promise.all([
    WorkspaceMemberModel.findOne({ workspaceId, userId, status: 'active' }).select('role hidden').lean(),
    UserModel.findById(userId).select('name phone').lean(),
  ]);
  if (!member) return null;
  return { userId, name: user?.name ?? '', ...(user?.phone ? { phone: user.phone } : {}), admin: canManageMembers(member.role), hidden: member.hidden === true };
}

const quoteFor = (quote: ProspectChannel['quote'], admin: boolean) => {
  if (!quote || admin) return quote;
  const { amount: _amount, currency: _currency, ...rest } = quote;
  return rest;
};

const INSIGHT_KEYS = ['name', 'source', 'listing', 'stage', 'service', 'intent', 'score', 'scoreReasons', 'fields', 'missing', 'readyAt', 'kind', 'summary', 'followUpDraft', 'unanswered'] as const;

/** The keys of `source` that hold a value. */
function pickDefined<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const picked: Partial<Pick<T, K>> = {};
  for (const key of keys) if (source[key] !== undefined && source[key] !== null) picked[key] = source[key];
  return picked;
}

function sellerView(doc: ProspectChannel): Pick<ProspectView, 'assignee' | 'nextAction' | 'result'> {
  const { assignee, nextAction, result } = doc;
  return {
    ...(assignee ? { assignee: { id: String(assignee.userId), name: assignee.name } } : {}),
    ...(nextAction ? { nextAction: { kind: nextAction.kind, at: iso(nextAction.at)!, assigneeId: String(nextAction.assigneeId), ...pickDefined(nextAction, ['note']) } } : {}),
    ...(result ? { result: { outcome: result.outcome, ...pickDefined(result, ['reason', 'note']), at: iso(result.at)!, by: { id: String(result.userId), name: result.name } } } : {}),
  };
}

function timingView(doc: ProspectChannel): Pick<ProspectView, 'firstContactAt' | 'lastContactAt' | 'firstDaliReplyAt' | 'firstTeamReply' | 'lastTeamReplyAt'> {
  const times = { firstContactAt: iso(doc.firstContactAt), lastContactAt: iso(doc.lastContactAt), firstDaliReplyAt: iso(doc.firstDaliReplyAt), lastTeamReplyAt: iso(doc.lastTeamReplyAt) };
  const reply = doc.firstTeamReply;
  return { ...pickDefined(times, ['firstContactAt', 'lastContactAt', 'firstDaliReplyAt', 'lastTeamReplyAt']), ...(reply ? { firstTeamReply: { at: iso(reply.at)!, userId: String(reply.userId) } } : {}) };
}

/** The prospect as a member receives it: `quote.amount` only for an admin (José: money is for admins). */
export function viewOf(doc: ProspectChannel, admin: boolean): ProspectView {
  return {
    id: doc.prospectId,
    chatId: String(doc.chatId),
    phone: doc.phone,
    lastActivityAt: doc.lastActivityAt,
    attendedBy: doc.attendedBy,
    ...pickDefined(doc, INSIGHT_KEYS),
    ...(doc.quote ? { quote: quoteFor(doc.quote, admin) } : {}),
    ...sellerView(doc),
    version: doc.version ?? 0,
    ...timingView(doc),
    createdAt: iso(doc.createdAt)!,
  };
}

/** Whether an app with `prospects:write` is installed here: the space's Dali tabs show only then. */
const isEnabled = async (workspaceId: string): Promise<boolean> =>
  Boolean(await BotInstallationModel.exists({ workspaceId: new Types.ObjectId(workspaceId), grantedScopes: PROSPECTS_SCOPE, revokedAt: { $exists: false } }));

function sinceOf(value: unknown, now: Date): Date {
  const asked = typeof value === 'string' ? new Date(value) : null;
  const floor = new Date(now.getTime() - SINCE_MAX_DAYS * DAY_MS);
  if (!asked || Number.isNaN(asked.getTime())) return new Date(now.getTime() - SINCE_DEFAULT_DAYS * DAY_MS);
  return asked < floor ? floor : asked;
}

/** The open prospects, plus the ones born or closed since `since` (the funnel's and the panel's period). */
export async function listProspects(workspaceId: string, userId: Types.ObjectId, query: Record<string, unknown>) {
  const member = await memberOf(workspaceId, userId);
  if (!member) return NOT_MEMBER;
  const since = sinceOf(query.since, new Date());
  const docs = await ProspectChannelModel.find({ workspaceId: new Types.ObjectId(workspaceId), $or: [{ result: { $exists: false } }, { 'result.at': { $gte: since } }, { createdAt: { $gte: since } }] })
    .sort({ lastActivityAt: -1 })
    .limit(LIST_MAX)
    .lean<ProspectChannel[]>();
  return { prospects: docs.map((doc) => viewOf(doc, member.admin)), admin: member.admin, enabled: await isEnabled(workspaceId), me: String(member.userId) };
}

export async function oneProspect(workspaceId: string, userId: Types.ObjectId, where: { prospectId: string } | { chatId: string }) {
  const member = await memberOf(workspaceId, userId);
  if (!member) return NOT_MEMBER;
  if ('chatId' in where && !Types.ObjectId.isValid(where.chatId)) return NOT_FOUND;
  const doc = await ProspectChannelModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), ...where }).lean<ProspectChannel | null>();
  return doc ? { prospect: viewOf(doc, member.admin) } : NOT_FOUND;
}

const DOCUMENTS_SHOWN = 20;
const DOCUMENT_KINDS = ['image', 'video', 'file'] as const;
type DocumentMessage = { seq: number; kind: ProspectDocument['kind']; at: Date; prospect?: { sentAt?: string }; media?: { url: string; mime?: string; fileName?: string } };

/** The ficha's «Documentos del cliente» (`GET …/prospects/:id/documents`): the files the prospect sent, not the team's. */
export async function prospectDocuments(workspaceId: string, userId: Types.ObjectId, prospectId: string) {
  const member = await memberOf(workspaceId, userId);
  if (!member) return NOT_MEMBER;
  const doc = await ProspectChannelModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), prospectId }).select('chatId').lean<Pick<ProspectChannel, 'chatId'> | null>();
  return doc ? { documents: await documentsOf(doc.chatId) } : NOT_FOUND;
}

async function documentsOf(chatId: Types.ObjectId): Promise<ProspectDocument[]> {
  const sent = await MessageModel.find({ chatId, kind: { $in: DOCUMENT_KINDS }, prospect: { $exists: true }, deletedAt: { $exists: false } })
    .select('seq kind at prospect.sentAt media.url media.mime media.fileName').sort({ at: -1 }).limit(DOCUMENTS_SHOWN).lean<DocumentMessage[]>();
  return sent.filter((message) => message.media?.url).map((message) => ({
    seq: message.seq,
    kind: message.kind,
    name: message.media!.fileName ?? message.kind,
    mime: message.media!.mime ?? 'application/octet-stream',
    url: toAbsoluteMediaUrl(message.media!.url),
    // When the client sent it on WhatsApp, not when agentes relayed it.
    at: message.prospect?.sentAt ?? message.at.toISOString(),
  }));
}

/** The member who decides and the prospect, or why not: hidden members only read. */
async function deskOf(workspaceId: string, prospectId: string, userId: Types.ObjectId): Promise<{ member: Member; doc: ProspectChannel } | DeskError> {
  const member = await memberOf(workspaceId, userId);
  if (!member) return NOT_MEMBER;
  if (member.hidden) return fail(403, 'incognito', INCOGNITO_COMPOSER);
  const doc = await ProspectChannelModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), prospectId }).lean<ProspectChannel | null>();
  return doc ? { member, doc } : NOT_FOUND;
}

const stale = (doc: ProspectChannel, member: Member): DeskError => ({ ...fail(409, 'stale', 'Alguien lo cambió antes que tú: mira cómo quedó.'), prospect: viewOf(doc, member.admin) });

async function activePerson(workspaceId: Types.ObjectId, id: string): Promise<{ userId: Types.ObjectId; name: string } | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const userId = new Types.ObjectId(id);
  const [member, user] = await Promise.all([WorkspaceMemberModel.exists({ workspaceId, userId, status: 'active' }), UserModel.findById(userId).select('name').lean()]);
  return member ? { userId, name: user?.name ?? '' } : null;
}

const NOT_A_MEMBER = fail(400, 'not_a_member', 'Esa persona no es miembro activo del espacio.');

async function personFor(doc: ProspectChannel, member: Member, id: string | undefined) {
  return !id || id === String(member.userId) ? { userId: member.userId, name: member.name } : activePerson(doc.workspaceId, id);
}

async function assigneeChange(doc: ProspectChannel, change: SellerChange, member: Member, update: Change): Promise<DeskError | null> {
  if (change.assignee === undefined) return null;
  if (change.assignee === null) {
    update.$unset.assignee = 1;
    return null;
  }
  const person = await personFor(doc, member, change.assignee === 'me' ? undefined : change.assignee.id);
  if (!person) return NOT_A_MEMBER;
  update.$set.assignee = person;
  return null;
}

async function nextActionChange(doc: ProspectChannel, change: SellerChange, member: Member, update: Change): Promise<DeskError | null> {
  if (change.nextAction === null) update.$unset.nextAction = 1;
  if (!change.nextAction) return null;
  const person = await personFor(doc, member, change.nextAction.assigneeId);
  if (!person) return NOT_A_MEMBER;
  const reminderId = doc.nextAction?.reminderId;
  update.$set.nextAction = { kind: change.nextAction.kind, at: new Date(change.nextAction.at), assigneeId: person.userId, ...pickDefined(change.nextAction, ['note']), ...(reminderId ? { reminderId } : {}) };
  return null;
}

/** A result clears the next action: Dali and the team stop following up. `null` reopens. */
function resultChange(change: SellerChange, member: Member, update: Change): void {
  if (change.result === null) update.$unset.result = 1;
  if (!change.result) return;
  update.$set.result = { outcome: change.result.outcome, ...pickDefined(change.result, ['reason', 'note']), at: new Date(), userId: member.userId, name: member.name };
  delete update.$set.nextAction;
  update.$unset.nextAction = 1;
}

/** The update a seller's change makes, or why it cannot be made. */
async function changeOf(doc: ProspectChannel, change: SellerChange, member: Member): Promise<Change | DeskError> {
  const update: Change = { $set: {}, $unset: {}, remind: change.nextAction?.remind ?? true };
  const refused = (await assigneeChange(doc, change, member, update)) ?? (await nextActionChange(doc, change, member, update));
  if (refused) return refused;
  resultChange(change, member, update);
  return update;
}

/** The next action rings in the Agenda of whoever does it; changed, it moves; gone (or a result), it goes quiet. */
async function syncReminder(before: ProspectChannel, after: ProspectChannel, remind: boolean): Promise<void> {
  const previous = before.nextAction?.reminderId;
  const action = after.nextAction;
  if (!action || !remind) {
    if (previous) await ReminderModel.updateOne({ _id: previous }, { $set: { active: false } });
    return;
  }
  const fields = { userId: action.assigneeId, title: `${NEXT_ACTION_LABEL[action.kind]} · ${prospectNameOf(after)}`, note: action.note ?? '', startsAt: action.at, active: true, remindedAt: null, advanceSent: [] };
  if (previous) {
    await ReminderModel.updateOne({ _id: previous }, { $set: fields });
    return;
  }
  const created = await ReminderModel.create({ ...fields, recurrence: 'once', prospectRef: { chatId: after.chatId, prospectId: after.prospectId } });
  await ProspectChannelModel.updateOne({ _id: after._id }, { $set: { 'nextAction.reminderId': created._id } });
}

const personWire = (member: Member) => ({ id: String(member.userId), name: member.name, ...(member.phone ? { phone: member.phone } : {}) });

/** Tells the members' inbox and agentes; a prospect whose app was removed has no agentes to tell. */
async function tellAgentes(doc: ProspectChannel, type: BotEventType, data: Record<string, unknown>, member: Member): Promise<void> {
  announceProspects(doc.workspaceId);
  const installation = await BotInstallationModel.findOne({ workspaceId: doc.workspaceId, appId: doc.appId, revokedAt: { $exists: false } }).select('_id workspaceId').lean();
  if (!installation) return;
  await sendBotEvent(installation, type, { prospect_id: doc.prospectId, ...data, user: personWire(member), at: new Date().toISOString(), version: doc.version });
}

function sellerStateWire(doc: ProspectChannel) {
  const { assignee, nextAction, result } = doc;
  return {
    assignee: assignee ? { id: String(assignee.userId), name: assignee.name } : null,
    next_action: nextAction ? { kind: nextAction.kind, at: iso(nextAction.at), assignee_id: String(nextAction.assigneeId), ...(nextAction.note ? { note: nextAction.note } : {}) } : null,
    result: result ? { outcome: result.outcome, ...(result.reason ? { reason: result.reason } : {}), ...(result.note ? { note: result.note } : {}), at: iso(result.at) } : null,
  };
}

/** Writes the update only if nobody changed the prospect since the seller looked (`version`). */
async function writeIfCurrent(doc: ProspectChannel, update: { $set?: Record<string, unknown>; $unset?: Record<string, 1> }): Promise<ProspectChannel | null> {
  const unset = update.$unset && Object.keys(update.$unset).length ? { $unset: update.$unset } : {};
  return ProspectChannelModel.findOneAndUpdate({ _id: doc._id, version: doc.version ?? 0 }, { ...(update.$set ? { $set: update.$set } : {}), ...unset, $inc: { version: 1 } }, { new: true }).lean<ProspectChannel | null>();
}

/** Re-reads after a lost race, for the 409 to show how it is now. */
async function staleNow(doc: ProspectChannel, member: Member): Promise<DeskError> {
  const now = await ProspectChannelModel.findById(doc._id).lean<ProspectChannel | null>();
  return stale(now ?? doc, member);
}

/** `PATCH`: take it, plan the next action, mark the result (or reopen). */
export async function changeProspect(workspaceId: string, prospectId: string, userId: Types.ObjectId, raw: unknown) {
  const valid = validateSellerChange(raw);
  if (!valid.ok) return fail(400, 'invalid_request', valid.message);
  const desk = await deskOf(workspaceId, prospectId, userId);
  if ('error' in desk) return desk;
  if ((desk.doc.version ?? 0) !== valid.change.version) return stale(desk.doc, desk.member);
  const change = await changeOf(desk.doc, valid.change, desk.member);
  if ('error' in change) return change;
  const updated = await writeIfCurrent(desk.doc, change);
  if (!updated) return staleNow(desk.doc, desk.member);
  await syncReminder(desk.doc, updated, change.remind);
  await tellAgentes(updated, 'prospect.updated', sellerStateWire(updated), desk.member);
  return { prospect: viewOf(updated, desk.member.admin) };
}

/** «Aprobar»: the seller approved (or edited) Dali's draft; agentes sends it by WhatsApp. The draft is used up. */
export async function approveFollowUp(workspaceId: string, prospectId: string, userId: Types.ObjectId, raw: unknown) {
  const body = record(raw);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!Number.isInteger(body.version) || !text || text.length > FOLLOW_UP_MAX) return fail(400, 'invalid_request', `Falta version, o el texto (hasta ${FOLLOW_UP_MAX}).`);
  const desk = await deskOf(workspaceId, prospectId, userId);
  if ('error' in desk) return desk;
  if ((desk.doc.version ?? 0) !== body.version) return stale(desk.doc, desk.member);
  if (desk.doc.result) return fail(409, 'closed', 'Este prospecto ya tiene resultado: Dali no le escribe más.');
  if (!desk.doc.followUpDraft) return fail(409, 'no_draft', 'Dali no tiene un seguimiento para aprobar.');
  const updated = await writeIfCurrent(desk.doc, { $unset: { followUpDraft: 1 } });
  if (!updated) return staleNow(desk.doc, desk.member);
  await tellAgentes(updated, 'prospect.follow_up.approved', { text }, desk.member);
  return { prospect: viewOf(updated, desk.member.admin) };
}

/** «Devolver a Dali»: the pill in the channel's header; agentes confirms it with its next PUT. */
export async function handBack(workspaceId: string, prospectId: string, userId: Types.ObjectId, raw: unknown) {
  const body = record(raw);
  if (!Number.isInteger(body.version)) return fail(400, 'invalid_request', 'Falta version.');
  const desk = await deskOf(workspaceId, prospectId, userId);
  if ('error' in desk) return desk;
  if ((desk.doc.version ?? 0) !== body.version) return stale(desk.doc, desk.member);
  const updated = await writeIfCurrent(desk.doc, { $set: { attendedBy: 'dali' } });
  if (!updated) return staleNow(desk.doc, desk.member);
  await tellAgentes(updated, 'prospect.handback', {}, desk.member);
  return { prospect: viewOf(updated, desk.member.admin) };
}

/** «Confirmar» / «Corregir» (fase 3): a seller settles what Dali read from a document; agentes keeps it as a firm fact. */
export async function confirmField(workspaceId: string, prospectId: string, userId: Types.ObjectId, raw: unknown) {
  const valid = validateFieldConfirmation(raw);
  if (!valid.ok) return fail(400, 'invalid_request', valid.message);
  const desk = await deskOf(workspaceId, prospectId, userId);
  if ('error' in desk) return desk;
  if ((desk.doc.version ?? 0) !== valid.confirmation.version) return stale(desk.doc, desk.member);
  const field = desk.doc.fields?.find((one) => one.key === valid.confirmation.key);
  if (!field) return fail(404, 'field_not_found', 'Ese dato ya no está en la ficha.');
  const value = valid.confirmation.value ?? field.value;
  const confirmed: ProspectField = { ...field, value, confirmed: true, confirmedBy: { id: String(desk.member.userId), name: desk.member.name, at: new Date().toISOString() } };
  const fields = desk.doc.fields!.map((one) => (one.key === field.key ? confirmed : one));
  const updated = await writeIfCurrent(desk.doc, { $set: { fields } });
  if (!updated) return staleNow(desk.doc, desk.member);
  await tellAgentes(updated, 'prospect.field.confirmed', { key: field.key, value, corrected: value !== field.value, ...(field.fileId ? { file_id: field.fileId } : {}) }, desk.member);
  return { prospect: viewOf(updated, desk.member.admin) };
}

import mongoose, { Types, type Model } from 'mongoose';
import { availableTo, canManageMembers, formLevelOf, itemSettingOf, openVisitRowsOf, pointProblem, SITE_VISIT_SHORTCUT, visitDocumentOf, visitSectionForm, type AppForm, type CommandOutcome, type FormSchema, type OpenVisitRow, type VisitDocument, type VisitPointDraft } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { UserModel } from '../models.js';
import { OUTDATED_FORM_MESSAGE, type CommandError } from './botCommands.js';
import { callBotWebhook, recordLastDelivery } from './botEvents.js';
import { BotAppModel, BotCommandRunModel, BotInstallationModel } from './botModels.js';
import { isClientChat } from './botClients.js';
import { itemPlaceOf } from './botCommands.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';

/**
 * A technical visit from the phone (José 13/11; contract with agentes 14/11, `BOTS-API.spec.md` c-visitas).
 * The door is the app's `visita_tecnica` item (José 14/11): the space admin turns it on in «Comandos» and
 * picks the 1:1, the channels and who, as with any command. No company switch in Portal. The document is
 * kept per person and visit for the section forms, as a field report's draft is.
 */
export type VisitPlace = 'channel' | 'direct';
type Door = { installation: { _id: Types.ObjectId; workspaceId: Types.ObjectId; signingSecret: string; appId: Types.ObjectId }; app: { _id: Types.ObjectId; name: string; webhookUrl: string }; place: VisitPlace; chatId: Types.ObjectId; chatKind: string };

const ASK_TIMEOUT_MS = 8_000;
const COMMAND_TTL_MS = 15 * 60_000;
const DRAFT_KEPT_S = 24 * 60 * 60;
const DEFAULT_FORMS_LEVEL = 3;
const NEW_VISIT_KEY = 'nueva';
const DRAFT_FAILED = 'No se pudo abrir la visita.';
const ENTRY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISIT_ID = /^[a-f0-9]{24}$/i;
const NOTHING_TO_FILL: FormSchema = { type: 'object', properties: {} };
const SECTIONS = ['datos', 'entrevista', 'conclusion'] as const;
type SectionId = (typeof SECTIONS)[number];

type VisitDraft = { _id: Types.ObjectId; workspaceId: Types.ObjectId; userId: Types.ObjectId; visitKey: string; document: unknown; updatedAt: Date };
const draftSchema = new mongoose.Schema<VisitDraft>(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    visitKey: { type: String, required: true },
    document: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);
draftSchema.index({ workspaceId: 1, userId: 1, visitKey: 1 }, { unique: true });
draftSchema.index({ updatedAt: 1 }, { expireAfterSeconds: DRAFT_KEPT_S });
export const VisitDraftModel: Model<VisitDraft> = (mongoose.models.VisitDraft as Model<VisitDraft>) ?? mongoose.model<VisitDraft>('VisitDraft', draftSchema);

const fail = (status: CommandError['status'], error: string, message: string): CommandError => ({ status, error, message });
const notFound = (): CommandError => fail(404, 'not_found', 'Las visitas técnicas se hacen en su canal.');
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const visitIdOf = (value: unknown): string | null => (typeof value === 'string' && VISIT_ID.test(value) ? value : null);

type DoorInstallation = Door['installation'] & { botUserId: Types.ObjectId; itemSettings?: Parameters<typeof itemSettingOf>[0]; itemsV2?: boolean };
type DoorChat = NonNullable<Parameters<typeof itemPlaceOf>[0]>;

/** Whether the admin's setting of the `visita_tecnica` item lets this person in at this chat. */
function placeOf(chat: DoorChat, installation: DoorInstallation, person: { userId: string; spaceAdmin: boolean }, client: boolean): VisitPlace | null {
  const setting = itemSettingOf(installation.itemSettings, 'shortcut', SITE_VISIT_SHORTCUT, !installation.itemsV2);
  const place = itemPlaceOf(chat, installation, client);
  if (place === 'space' || !availableTo('shortcut', SITE_VISIT_SHORTCUT, setting, place, person)) return null;
  return place === 'direct' ? 'direct' : 'channel';
}

/** The door: an active member of this chat, where an installed app's `visita_tecnica` item is on for them. */
export async function visitDoorOf(workspaceId: string, chatId: unknown, userId: Types.ObjectId): Promise<Door | null> {
  if (!Types.ObjectId.isValid(workspaceId) || typeof chatId !== 'string' || !Types.ObjectId.isValid(chatId)) return null;
  const [chat, member, apps, client] = await Promise.all([
    ChatModel.findOne({ _id: chatId, workspaceId, 'members.userId': userId }).select('_id kind members.userId').lean<DoorChat | null>(),
    WorkspaceMemberModel.findOne({ workspaceId, userId, status: 'active' }).select('role').lean(),
    BotAppModel.find({ 'shortcuts.key': SITE_VISIT_SHORTCUT }).select('_id name webhookUrl').lean(),
    isClientChat(chatId),
  ]);
  if (!chat || !member || !apps.length) return null;
  const person = { userId: String(userId), spaceAdmin: canManageMembers(member.role) };
  const installations = await BotInstallationModel.find({ workspaceId: new Types.ObjectId(workspaceId), appId: { $in: apps.map((app) => app._id) }, revokedAt: { $exists: false } }).select('_id workspaceId signingSecret appId botUserId itemSettings itemsV2').lean<DoorInstallation[]>();
  for (const installation of installations) {
    const app = apps.find((one) => String(one._id) === String(installation.appId));
    const place = app?.webhookUrl ? placeOf(chat, installation, person, client) : null;
    if (app?.webhookUrl && place) return { installation, app: { _id: app._id, name: app.name, webhookUrl: app.webhookUrl }, place, chatId: chat._id, chatKind: chat.kind };
  }
  return null;
}

async function askerOf(userId: Types.ObjectId) {
  const user = await UserModel.findById(userId).select('name phone').lean();
  return { id: String(userId), ...(user?.name ? { name: user.name } : {}), ...(user?.phone ? { phone: user.phone } : {}) };
}

export type VisitDraftOutcome = { ok: true; document: VisitDocument; visits: OpenVisitRow[] } | { ok: false; message: string; code?: string };

/** Agentes' refusal as it came (`visitas_apagadas` while Portal's switch is off): its text is what the person reads. */
function refusalOf(body: unknown): { message: string; code?: string } | null {
  const answer = record(body);
  return typeof answer.message === 'string' && typeof answer.error === 'string' ? { message: answer.message, code: answer.error } : null;
}

/** A visit's document, or a new one with the open visits; kept for the section forms that follow. */
export async function siteVisitDraft(workspaceId: string, userId: Types.ObjectId, input: unknown): Promise<VisitDraftOutcome | CommandError> {
  const body = record(input);
  const visitId = body.visit_id === undefined ? null : visitIdOf(body.visit_id);
  if (body.visit_id !== undefined && !visitId) return fail(400, 'invalid_request', 'Esa visita no existe.');
  const door = await visitDoorOf(workspaceId, body.chat_id, userId);
  if (!door) return notFound();
  const reply = await callBotWebhook({ ...door.installation, webhookUrl: door.app.webhookUrl }, 'visit.draft.requested', { ...(visitId ? { visita_id: visitId } : {}), channel_id: String(door.chatId), channel: { id: String(door.chatId), kind: door.chatKind }, place: door.place, user: await askerOf(userId) }, ASK_TIMEOUT_MS);
  const answer = record(reply.body);
  const document = reply.status === 200 ? visitDocumentOf(answer.document) : null;
  recordLastDelivery(door.installation._id, document ? { ok: true } : { ok: false, error: reply.error ?? `HTTP ${reply.status}` });
  if (!document) return { ok: false, ...(refusalOf(reply.body) ?? { message: DRAFT_FAILED }) };
  await VisitDraftModel.updateOne({ workspaceId: new Types.ObjectId(workspaceId), userId, visitKey: document.id ?? NEW_VISIT_KEY }, { $set: { document: answer.document } }, { upsert: true });
  return { ok: true, document, visits: openVisitRowsOf(answer.visitas) };
}

type Opened = { form: AppForm; context: Record<string, string | number> };
type Place = { lat?: number; lng?: number; precisionM?: number };

const finite = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
function placeOfInput(body: Record<string, unknown>): Place {
  const [lat, lng, precisionM] = [finite(body.lat), finite(body.lng), finite(body.precision_m)];
  return { ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}), ...(precisionM !== undefined && precisionM >= 0 ? { precisionM } : {}) };
}
const noFields = (id: string, title: string, submitLabel: string): AppForm => ({ id, title, submitLabel, schema: NOTHING_TO_FILL });

async function keptDocument(workspaceId: string, userId: Types.ObjectId, visitId: string | null): Promise<VisitDocument | null> {
  const kept = await VisitDraftModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), userId, visitKey: visitId ?? NEW_VISIT_KEY }).lean();
  return kept ? visitDocumentOf(kept.document) : null;
}

/** «Datos», the interview or the conclusion: Portal's schema with what is saved. A new visit also takes the phone's place. */
async function sectionOpened(workspaceId: string, userId: Types.ObjectId, body: Record<string, unknown>, visitId: string | null): Promise<Opened | CommandError> {
  const section = SECTIONS.includes(body.section as SectionId) ? (body.section as SectionId) : null;
  if (!section || (!visitId && section !== 'datos')) return fail(400, 'invalid_request', 'Falta qué parte de la visita abrir.');
  const document = await keptDocument(workspaceId, userId, visitId);
  const form = document ? visitSectionForm(document, section) : null;
  if (!form) return fail(409, 'draft_not_open', 'Abre la visita de nuevo para seguir.');
  return { form, context: { ...(visitId ? { visitaId: visitId } : placeOfInput(body)), seccion: section } };
}

/** The point as the phone sent it, before Portal's checks. */
function pointDraftOf(body: Record<string, unknown>): { draft: VisitPointDraft; precisionM?: number } {
  const place = placeOfInput(body);
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const measure = finite(body.measure);
  const draft: VisitPointDraft = { type: String(body.type ?? ''), lat: place.lat ?? Number.NaN, lng: place.lng ?? Number.NaN, ...(note ? { note } : {}), ...(measure !== undefined ? { measure } : {}), ...(typeof body.unit === 'string' ? { unit: body.unit } : {}) };
  return { draft, ...(place.precisionM !== undefined ? { precisionM: place.precisionM } : {}) };
}

/** A point is chosen on the phone's own screen (lv02): everything rides as context and the form has nothing to fill. */
async function pointOpened(workspaceId: string, userId: Types.ObjectId, body: Record<string, unknown>, visitId: string): Promise<Opened | CommandError> {
  const { draft, precisionM } = pointDraftOf(body);
  const note = draft.note ?? '';
  const document = await keptDocument(workspaceId, userId, visitId);
  if (!document) return fail(409, 'draft_not_open', 'Abre la visita de nuevo para seguir.');
  const problem = pointProblem(draft, document);
  if (problem) return fail(400, 'invalid_request', problem);
  if (typeof body.entry_id !== 'string' || !ENTRY_ID.test(body.entry_id)) return fail(400, 'invalid_request', 'Falta la clave del punto.');
  const source = body.source === 'web' ? 'web' : 'apk';
  const measure: Record<string, string | number> = draft.measure !== undefined && draft.unit ? { medida: draft.measure, unidad: draft.unit } : {};
  return { form: noFields('marcar_punto_de_visita', `Punto ${document.points.length + 1}`, 'Guardar punto'), context: { visitaId: visitId, entradaId: body.entry_id, tipo: draft.type, lat: draft.lat, lng: draft.lng, ...(precisionM !== undefined ? { precisionM } : {}), ...(note ? { nota: note } : {}), ...measure, fuente: source } };
}

function simpleOpened(kind: unknown, visitId: string, body: Record<string, unknown>): Opened | CommandError {
  if (kind === 'photo') {
    const pointId = typeof body.point_id === 'string' && ENTRY_ID.test(body.point_id) ? body.point_id : null;
    return { form: noFields('subir_foto_de_visita', 'Subir fotos', 'Subir'), context: { visitaId: visitId, ...(pointId ? { puntoId: pointId } : {}) } };
  }
  if (kind === 'finish') return { form: noFields('terminar_visita', 'Terminar visita', 'Terminar'), context: { visitaId: visitId } };
  if (kind === 'pdf') return { form: noFields('pdf_de_visita', 'PDF de la visita', 'Ver PDF'), context: { visitaId: visitId } };
  return fail(400, 'invalid_request', 'Falta qué parte de la visita abrir.');
}

function opened(workspaceId: string, userId: Types.ObjectId, body: Record<string, unknown>): Promise<Opened | CommandError> | Opened | CommandError {
  const visitId = body.visit_id === undefined ? null : visitIdOf(body.visit_id);
  if (body.visit_id !== undefined && !visitId) return fail(400, 'invalid_request', 'Esa visita no existe.');
  if (body.kind === 'section') return sectionOpened(workspaceId, userId, body, visitId);
  if (!visitId) return fail(400, 'invalid_request', 'Falta la visita.');
  if (body.kind === 'point') return pointOpened(workspaceId, userId, body, visitId);
  return simpleOpened(body.kind, visitId, body);
}

/**
 * Opens one of the visit's writes as a run of the app: the phone then sends it through `/commands/:id/form`
 * like any form, and `form.submitted` carries the channel and the place beside the values (agentes holds the door).
 */
export async function openVisitForm(workspaceId: string, userId: Types.ObjectId, input: unknown): Promise<CommandOutcome | CommandError> {
  const body = record(input);
  const door = await visitDoorOf(workspaceId, body.chat_id, userId);
  if (!door) return notFound();
  const ready = await opened(workspaceId, userId, body);
  if ('error' in ready) return ready;
  const formsLevel = typeof body.forms === 'number' ? body.forms : DEFAULT_FORMS_LEVEL;
  if (formLevelOf(ready.form) > formsLevel) return fail(409, 'outdated_app', OUTDATED_FORM_MESSAGE);
  const run = await BotCommandRunModel.create({
    installationId: door.installation._id, chatId: door.chatId, workspaceId: new Types.ObjectId(workspaceId), userId,
    command: ready.form.id, formsLevel, trigger: 'shortcut', form: ready.form, context: ready.context,
    visit: { channelId: String(door.chatId), place: door.place }, expiresAt: new Date(Date.now() + COMMAND_TTL_MS),
  });
  return { commandId: String(run._id), appId: String(door.app._id), appName: door.app.name, outcome: 'form', response: { responseType: 'form', form: ready.form } };
}

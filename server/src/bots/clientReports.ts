import mongoose, { Types, type Model } from 'mongoose';
import { channelValuesOf, CLIENT_ID, fieldDocumentOf, formLevelOf, SECTION_TOOL, sectionFormOf, type AppForm, type CommandOutcome, type FieldDocument, type FormSchema, type SectionPath } from '@lilachat/shared';
import { OUTDATED_FORM_MESSAGE, type CommandError } from './botCommands.js';
import { askAboutService, findAskedService, notFound, type AskOutcome, type NotFound, type ServiceAsk } from './clientFiles.js';
import { BotAppModel, BotCommandRunModel, BotInstallationModel } from './botModels.js';

/**
 * A field report filled from the client's channel (José 05/11/2026, spec
 * INFORMES-DESDE-LILACHAT §4.2). Portal answers the document; every section,
 * photo and «Publicar» is then a real form of the app, opened here as a run
 * and sent through the form routes like any other. The door is the same as
 * the Detalle's (`findAskedService`), and the checked service rides beside
 * the answers so agentes holds the border between clients.
 */
export const PUBLISH_TOOL = 'publicar_informe';
/** The report types that open from Lilachat today; Portal's `tipo` enum says the same. */
export const OPEN_REPORT_TYPES = ['CTL-IMP'] as const;
const DRAFT_FAILED = 'No se pudo abrir el informe';
const DRAFT_KEPT_S = 24 * 60 * 60;
const COMMAND_TTL_MS = 15 * 60_000;
const DEFAULT_FORMS_LEVEL = 3;
const TEXT_MAX = 200;

/** Portal's `publicar_informe`: the report is context; the note is the person's confirmation with something to say. */
const PUBLISH_FORM: FormSchema = { type: 'object', properties: { nota: { type: 'string', title: 'Nota para el canal', maxLength: TEXT_MAX } } };

/** The last document Portal answered, per person and service: the section forms are built from it, never from the phone. */
type ReportDraft = { _id: Types.ObjectId; workspaceId: Types.ObjectId; userId: Types.ObjectId; serviceId: string; type: string; document: FieldDocument; updatedAt: Date };
const draftSchema = new mongoose.Schema<ReportDraft>(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    serviceId: { type: String, required: true },
    type: { type: String, required: true },
    document: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);
draftSchema.index({ workspaceId: 1, userId: 1, serviceId: 1, type: 1 }, { unique: true });
draftSchema.index({ updatedAt: 1 }, { expireAfterSeconds: DRAFT_KEPT_S });
export const ReportDraftModel: Model<ReportDraft> = (mongoose.models.ReportDraft as Model<ReportDraft>) ?? mongoose.model<ReportDraft>('ReportDraft', draftSchema);

const DRAFT: ServiceAsk<FieldDocument> = { event: 'client.report.draft.requested', parse: fieldDocumentOf, failed: DRAFT_FAILED, gone: 'Este informe ya no está en el Portal.', label: 'Borrador del informe', need: 'services' };
const fail = (status: CommandError['status'], error: string, message: string): CommandError => ({ status, error, message });
const text = (value: unknown, max = TEXT_MAX): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const isOpenType = (value: unknown): value is (typeof OPEN_REPORT_TYPES)[number] => OPEN_REPORT_TYPES.includes(value as (typeof OPEN_REPORT_TYPES)[number]);

/** The document of a report, or the empty one for a new report of that type; kept for the forms that follow. */
export async function clientReportDraft(workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId, input: unknown): Promise<AskOutcome<FieldDocument> | NotFound | CommandError> {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const reportId = text(body.report_id, 64);
  if (!isOpenType(body.type) || (reportId && !CLIENT_ID.test(reportId))) return fail(400, 'invalid_request', 'Ese tipo de informe no se crea desde Lilachat.');
  const asked = await askAboutService(DRAFT, workspaceId, clientId, serviceId, userId, { type: body.type, ...(reportId ? { report_id: reportId } : {}) });
  if ('ok' in asked && asked.ok) {
    await ReportDraftModel.updateOne({ workspaceId: new Types.ObjectId(workspaceId), userId, serviceId, type: body.type }, { $set: { document: asked.value } }, { upsert: true });
  }
  return asked;
}

type Place = { lat?: number; lng?: number; at: string };
type OpenInput =
  | { kind: 'section'; type: string; path: SectionPath; reportId: string | null; tramoId: string | null; place: Place | null }
  | { kind: 'publish'; reportId: string };

const pathOf = (raw: Record<string, unknown>): SectionPath | null => {
  const sectionId = text(raw.section_id, 64);
  const key = text(raw.key, 64);
  const itemId = raw.item_id === null || raw.item_id === undefined ? null : text(raw.item_id, 64);
  return sectionId && key && itemId !== '' ? { sectionId, itemId, key } : null;
};

/** Where and when a photo was taken; the place may be missing, the hour may not. Off the map is a refusal, not a guess. */
function placeOf(raw: Record<string, unknown>): Place | null | 'invalid' {
  const at = text(raw.at, 40);
  if (!at && raw.lat === undefined && raw.lng === undefined) return null;
  if (!at || Number.isNaN(Date.parse(at))) return 'invalid';
  if (raw.lat === undefined && raw.lng === undefined) return { at };
  const [lat, lng] = [Number(raw.lat), Number(raw.lng)];
  const placed = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return placed ? { lat, lng, at } : 'invalid';
}

/** What the phone asked to open; anything off the contract is a 400 before touching the door. */
function openInputOf(input: unknown): OpenInput | null {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const reportId = text(raw.report_id, 64);
  if (raw.kind === 'publish') return reportId ? { kind: 'publish', reportId } : null;
  const path = raw.kind === 'section' ? pathOf(raw) : null;
  const place = placeOf(raw);
  if (!path || !isOpenType(raw.type) || place === 'invalid') return null;
  const tramoId = text(raw.tramo_id, 64);
  return { kind: 'section', type: raw.type, path, reportId: reportId || null, tramoId: tramoId || null, place };
}

type Prepared = { form: AppForm; context: Record<string, string | number> };

/** Each tool takes only the keys it declares (agentes refuses the rest): the photo one wants the report, the tramo and the hour. */
function contextFor(form: AppForm, serviceId: string, input: Extract<OpenInput, { kind: 'section' }>, reportId: string | null, tramoId: string | null): { context: Record<string, string | number> } | CommandError {
  if (form.id === SECTION_TOOL) return { context: { servicioId: serviceId, tipo: input.type, seccion: input.path.key, ...(reportId ? { informeId: reportId } : {}), ...(tramoId ? { tramoId } : {}) } };
  if (!reportId || !tramoId || !input.place) return fail(400, 'invalid_request', 'Una foto necesita el informe, el tramo y la hora de la captura.');
  const { lat, lng, at } = input.place;
  return { context: { servicioId: serviceId, informeId: reportId, tramoId, at, ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}) } };
}

/** The section's form comes from the document Portal answered to THIS person; the report, section and tramo ride as context. */
async function sectionPrepared(workspaceId: string, serviceId: string, userId: Types.ObjectId, input: Extract<OpenInput, { kind: 'section' }>): Promise<Prepared | CommandError> {
  const draft = await ReportDraftModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), userId, serviceId, type: input.type }).lean();
  const form = draft ? sectionFormOf(draft.document, input.path) : null;
  if (!draft || !form) return fail(409, 'draft_not_open', 'Abre el informe de nuevo para seguir llenándolo.');
  const built = contextFor(form, serviceId, input, input.reportId ?? draft.document.id, input.tramoId ?? input.path.itemId);
  return 'error' in built ? built : { form, context: { ...built.context, ...channelValuesOf(draft.document, input.path) } };
}

function prepared(workspaceId: string, serviceId: string, userId: Types.ObjectId, input: OpenInput): Promise<Prepared | CommandError> | Prepared {
  if (input.kind === 'section') return sectionPrepared(workspaceId, serviceId, userId, input);
  return { form: { id: PUBLISH_TOOL, title: 'Publicar informe', submitLabel: 'Publicar', schema: PUBLISH_FORM }, context: { servicioId: serviceId, informeId: input.reportId } };
}

/**
 * Opens one of the report's forms as a run of the client's app: the phone then
 * uploads its photo and sends it through `/commands/:id/files` and `/form`
 * like any form. `formsLevel` says what the asker's Lilachat can draw.
 */
export async function openReportForm(workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId, input: unknown): Promise<CommandOutcome | CommandError> {
  const open = openInputOf(input);
  if (!open) return fail(400, 'invalid_request', 'Falta qué parte del informe abrir.');
  const asked = await findAskedService(workspaceId, clientId, serviceId, userId, 'services');
  if (!asked) return notFound();
  const ready = await prepared(workspaceId, serviceId, userId, open);
  if ('error' in ready) return ready;
  const formsLevel = typeof (input as { forms?: unknown }).forms === 'number' ? Number((input as { forms: number }).forms) : DEFAULT_FORMS_LEVEL;
  if (formLevelOf(ready.form) > formsLevel) return fail(409, 'outdated_app', OUTDATED_FORM_MESSAGE);
  const [installation, app] = await Promise.all([
    BotInstallationModel.findOne({ appId: asked.client.appId, workspaceId: new Types.ObjectId(workspaceId), revokedAt: { $exists: false } }).select('_id').lean(),
    BotAppModel.findById(asked.client.appId).select('name').lean(),
  ]);
  if (!installation || !app) return fail(410, 'app_uninstalled', 'La app ya no está instalada en este espacio.');
  const run = await BotCommandRunModel.create({
    installationId: installation._id, chatId: asked.client.chatId, workspaceId: new Types.ObjectId(workspaceId), userId,
    command: ready.form.id, formsLevel, trigger: 'shortcut', form: ready.form, context: ready.context,
    service: { clientId, serviceId }, expiresAt: new Date(Date.now() + COMMAND_TTL_MS),
  });
  return { commandId: String(run._id), appId: String(app._id), appName: app.name, outcome: 'form', response: { responseType: 'form', form: ready.form } };
}

export { SECTION_TOOL };

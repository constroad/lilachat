import mongoose, { Types, type Model } from 'mongoose';
import { channelValuesOf, CLIENT_ID, SERVICE_LINK_ACTION, fieldDocumentOf, formLevelOf, photoKindOf, requiresLocation, SECTION_TOOL, sectionAt, sectionFormOf, type AppForm, type CommandOutcome, type FieldDocument, type FormSchema, type SectionPath } from '@lilachat/shared';
import { OUTDATED_FORM_MESSAGE, type CommandError } from './botCommands.js';
import { askAboutService, findAskedService, notFound, type AskOutcome, type NotFound, type ServiceAsk } from './clientFiles.js';
import { BotAppModel, BotCommandRunModel, BotInstallationModel } from './botModels.js';
import { ClientChannelModel } from './botClients.js';
import { workProgressInputOf, workProgressPrepared, type WorkProgressInput } from './workProgressForm.js';
import { photoPhaseInputOf, photoPhasePrepared, type PhotoPhaseContext, type PhotoPhaseInput } from './photoPhaseForm.js';
import { workStreetDeleteInputOf, workStreetDeletePrepared, workStreetInputOf, workStreetPrepared, type StreetContext, type WorkStreetDeleteInput, type WorkStreetInput } from './workStreetForm.js';
import { workManualProgressInputOf, workManualProgressPrepared, type WorkManualProgressInput } from './workManualProgressForm.js';
import { isWorkMapFormInput, isWorkMapFormKind, workMapFormInputOf, workMapFormPrepared, type WorkMapFormContext, type WorkMapFormInput } from './workMapForms.js';

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
export const OPEN_REPORT_TYPES = ['CTL-IMP', 'CTL-PIS'] as const;
const DRAFT_FAILED = 'No se pudo abrir el informe';
const DRAFT_KEPT_S = 24 * 60 * 60;
const COMMAND_TTL_MS = 15 * 60_000;
const DEFAULT_FORMS_LEVEL = 3;
const TEXT_MAX = 200;

/** Portal's `publicar_informe`: the report is context; the note is the person's confirmation with something to say. */
const PUBLISH_FORM: FormSchema = { type: 'object', properties: { nota: { type: 'string', title: 'Nota para el canal', maxLength: TEXT_MAX } } };

/** Portal's `quitar_foto_de_informe`: everything is context, and the person already confirmed on the phone. */
const REMOVE_PHOTO_TOOL = 'quitar_foto_de_informe';
/** The photo tool that takes the photo's kind (`tipoFoto`). */
const KINDED_PHOTO_TOOL = 'agregar_foto_de_informe';
/** Portal's `subir_al_drive`: its answer is the ticket the phone sends the file with. */
const DRIVE_UPLOAD_TOOL = 'subir_al_drive';
const NOTHING_TO_FILL: FormSchema = { type: 'object', properties: {} };
/** Portal's `crear_enlace_de_servicio` without its service list: the service is the channel's (José 07/11). */
const SERVICE_LINK_FORM: FormSchema = {
  type: 'object',
  properties: {
    dias: { type: 'number', title: 'Días', exclusiveMinimum: 0, maximum: 60, description: 'Cuántos días dura el enlace. Sin esto, 7; como máximo 60.' },
    noExpira: { type: 'boolean', title: 'No expira', default: false, description: 'El enlace queda abierto hasta que lo revoquen en Portal. Ignora los días.' },
  },
};

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
  const page = pageOf(body.page);
  if (page === 'invalid') return fail(400, 'invalid_request', 'La página de unidades empieza en 1.');
  const asked = await askAboutService(DRAFT, workspaceId, clientId, serviceId, userId, { type: body.type, ...(reportId ? { report_id: reportId } : {}), ...(page ? { page } : {}) });
  if ('ok' in asked && asked.ok) {
    await ReportDraftModel.updateOne({ workspaceId: new Types.ObjectId(workspaceId), userId, serviceId, type: body.type }, { $set: { document: asked.value } }, { upsert: true });
  }
  return asked;
}

/** A window of units (50 a page, agentes maps it to `pagina` from the second on): an integer from 1, nothing, or a refusal. */
function pageOf(raw: unknown): number | null | 'invalid' {
  if (raw === undefined || raw === null) return null;
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : 'invalid';
}

type Place = { lat?: number; lng?: number; at: string };
type OpenInput =
  | { kind: 'section'; type: string; path: SectionPath; reportId: string | null; tramoId: string | null; place: Place | null; /** The save's own key: Portal tells a photo sent twice from a second one. */ clientKey: string | null }
  | { kind: 'publish'; reportId: string }
  | { kind: 'remove_photo'; reportId: string; photoId: string }
  | { kind: 'drive_upload' }
  | { kind: 'service_link' }
  | WorkProgressInput
  | WorkManualProgressInput
  | WorkStreetInput
  | WorkStreetDeleteInput
  | PhotoPhaseInput
  | WorkMapFormInput;

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

const removalOf = (reportId: string, photoId: string): OpenInput | null => (reportId && photoId ? { kind: 'remove_photo', reportId, photoId } : null);

/** What the phone asked to open; anything off the contract is a 400 before touching the door. */
function openInputOf(input: unknown): OpenInput | null {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  if (raw.kind === 'drive_upload') return { kind: 'drive_upload' };
  if (raw.kind === 'service_link') return { kind: 'service_link' };
  if (raw.kind === 'work_progress') return workProgressInputOf(raw);
  if (raw.kind === 'work_manual_progress') return workManualProgressInputOf(raw);
  if (raw.kind === 'work_street') return workStreetInputOf(raw);
  if (raw.kind === 'work_street_delete') return workStreetDeleteInputOf(raw);
  if (raw.kind === 'photo_phase') return photoPhaseInputOf(raw);
  if (isWorkMapFormKind(raw.kind)) return workMapFormInputOf(raw);
  const reportId = text(raw.report_id, 64);
  if (raw.kind === 'publish') return reportId ? { kind: 'publish', reportId } : null;
  if (raw.kind === 'remove_photo') return removalOf(reportId, text(raw.photo_id, 64));
  const path = raw.kind === 'section' ? pathOf(raw) : null;
  const place = placeOf(raw);
  if (!path || !isOpenType(raw.type) || place === 'invalid') return null;
  const tramoId = text(raw.tramo_id, 64);
  const clientKey = text(raw.client_key, 64);
  return { kind: 'section', type: raw.type, path, reportId: reportId || null, tramoId: tramoId || null, place, clientKey: clientKey || null };
}

type Prepared = { form: AppForm; context: Record<string, string | number | string[]> | StreetContext | WorkMapFormContext | PhotoPhaseContext };

type PhotoTerms = { reportId: string | null; tramoId: string | null; /** Portal's `seccion` is the form the person filled, not the template entry (`datos` → `unidad` in CTL-PIS; equal in CTL-IMP). */ sectionForm: string; /** The section's `tipoFoto` (CTL-PIS) and whether it refuses a capture without a fix. */ photoKind?: string; requireLocation: boolean };

/** Each tool takes only the keys it declares (agentes refuses the rest): the photo one wants the report, the tramo, the hour, its kind and its key. */
function contextFor(form: AppForm, serviceId: string, input: Extract<OpenInput, { kind: 'section' }>, terms: PhotoTerms): { context: Record<string, string | number> } | CommandError {
  const { reportId, tramoId, photoKind } = terms;
  if (form.id === SECTION_TOOL) return { context: { servicioId: serviceId, tipo: input.type, seccion: terms.sectionForm, ...(reportId ? { informeId: reportId } : {}), ...(tramoId ? { tramoId } : {}) } };
  if (!reportId || !tramoId || !input.place) return fail(400, 'invalid_request', 'Una foto necesita el informe, el tramo y la hora de la captura.');
  const { lat, lng, at } = input.place;
  const placed = lat !== undefined && lng !== undefined;
  if (terms.requireLocation && !placed) return fail(400, 'invalid_request', 'Esta foto necesita la ubicación del teléfono.');
  // Only the fixed-photo tool declares `tipoFoto`; the extra photo's tool has none and agentes refuses unknown keys (José 07/11).
  const kind: Record<string, string> = photoKind && form.id === KINDED_PHOTO_TOOL ? { tipoFoto: photoKind } : {};
  return { context: { servicioId: serviceId, informeId: reportId, tramoId, at, ...(placed ? { lat, lng } : {}), ...kind, ...(input.clientKey ? { clientKey: input.clientKey } : {}) } };
}

/** The section's form comes from the document Portal answered to THIS person; the report, section and tramo ride as context. */
async function sectionPrepared(workspaceId: string, serviceId: string, userId: Types.ObjectId, input: Extract<OpenInput, { kind: 'section' }>): Promise<Prepared | CommandError> {
  const draft = await ReportDraftModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), userId, serviceId, type: input.type }).lean();
  const form = draft ? sectionFormOf(draft.document, input.path) : null;
  if (!draft || !form) return fail(409, 'draft_not_open', 'Abre el informe de nuevo para seguir llenándolo.');
  const built = contextFor(form, serviceId, input, { reportId: input.reportId ?? draft.document.id, tramoId: input.tramoId ?? input.path.itemId, sectionForm: sectionAt(draft.document, input.path)?.form ?? input.path.key, photoKind: photoKindOf(draft.document, input.path), requireLocation: requiresLocation(draft.document, input.path) });
  return 'error' in built ? built : { form, context: { ...built.context, ...channelValuesOf(draft.document, input.path) } };
}

function prepared(workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId, input: OpenInput): Promise<Prepared | CommandError> | Prepared {
  if (input.kind === 'section') return sectionPrepared(workspaceId, serviceId, userId, input);
  if (input.kind === 'work_progress') return workProgressPrepared(workspaceId, clientId, serviceId, userId, input);
  if (input.kind === 'work_manual_progress') return workManualProgressPrepared(serviceId, input);
  if (input.kind === 'work_street') return workStreetPrepared(serviceId, input);
  if (input.kind === 'work_street_delete') return workStreetDeletePrepared(serviceId, input);
  if (input.kind === 'photo_phase') return photoPhasePrepared(serviceId, input);
  if (isWorkMapFormInput(input)) return workMapFormPrepared(serviceId, input);
  if (input.kind === 'service_link') return { form: { id: SERVICE_LINK_ACTION, title: 'Enlace del servicio', submitLabel: 'Crear enlace', schema: SERVICE_LINK_FORM }, context: { servicioId: serviceId } };
  if (input.kind === 'drive_upload') return { form: { id: DRIVE_UPLOAD_TOOL, title: 'Subir al Drive', submitLabel: 'Subir', schema: NOTHING_TO_FILL }, context: { servicioId: serviceId } };
  if (input.kind === 'remove_photo') return { form: { id: REMOVE_PHOTO_TOOL, title: 'Quitar foto', submitLabel: 'Quitar', schema: NOTHING_TO_FILL }, context: { servicioId: serviceId, informeId: input.reportId, fotoId: input.photoId } };
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
  const ready = await prepared(workspaceId, clientId, serviceId, userId, open);
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

/**
 * José 07/11, «solo el servicio del canal»: in a client's channel the service link opens here with its
 * service fixed. Agentes used to fill its list by asking Portal for every service of the company as the
 * person, and a field engineer without a Portal account got «Conecta tu cuenta». Elsewhere, null: the app answers.
 */
export async function openChannelServiceLink(userId: Types.ObjectId, chatId: string | undefined, input: { appId: unknown; shortcut: unknown; values?: unknown; forms?: unknown }): Promise<CommandOutcome | CommandError | null> {
  const serviceId = (input.values as { servicioId?: unknown } | undefined)?.servicioId;
  if (input.shortcut !== SERVICE_LINK_ACTION || typeof serviceId !== 'string' || !chatId || !Types.ObjectId.isValid(chatId)) return null;
  const client = await ClientChannelModel.findOne({ chatId: new Types.ObjectId(chatId) }).select('workspaceId appId clientId').lean();
  if (!client || String(client.appId) !== String(input.appId)) return null;
  return openReportForm(String(client.workspaceId), client.clientId, serviceId, userId, { kind: 'service_link', forms: input.forms });
}

export { SECTION_TOOL };

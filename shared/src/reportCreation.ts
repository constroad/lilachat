import type { ServiceDetail } from './serviceDetail.js';
import type { PhotoPhaseRequest } from './photoPhase.js';
import type { WorkProgressRequest } from './workProgressSend.js';
import type { WorkStreetRequest } from './workStreetDraft.js';
import type { WorkStreetDeleteRequest } from './workStreetDelete.js';
import type { WorkDeletedRequest, WorkRestoreRequest } from './workDeleted.js';
import type { LayerDeleteRequest, LayerEditRequest } from './workLayerEdit.js';
import type { WorkManualProgressRequest } from './workManualProgress.js';
import type { WorkProgressLinkRequest } from './workProgressLink.js';
import type { WorkImportRequest } from './workImport.js';
import type { WorkProgressPdfRequest } from './workProgressPdf.js';
import type { WorkMapInReportRequest } from './workMapInReport.js';
import type { WorkScopeDeleteRequest, WorkScopeRequest, WorkStageRequest, WorkTagRequest } from './workScopeDraft.js';
import type { ServiceLinkRequest } from './serviceMap.js';
import { FORMS_LEVEL } from './appForms.js';
import type { EphemeralAnswer } from './botCommands.js';
import type { DriveUploadRequest } from './driveUpload.js';
import { fieldDocumentOf, type DocumentSection, type DocumentStatus, type FieldDocument, type RepeatSection, type SectionPath, type SectionState } from './fieldDocument.js';
import { clientServicePath } from './serviceAsk.js';
import { locationMapLink } from './sharedLocation.js';
import type { DetailTone } from './serviceDetail.js';

/**
 * Creating a field report from the client's channel (José 05/11/2026, spec
 * INFORMES-DESDE-LILACHAT §4.3): the types the picker offers, what the phone
 * asks the server and what the cards say. The APK and the web draw from
 * here. PURE.
 */
export type ReportTypeOption = { code: string; label: string; caption: string; /** Created here; the rest open Portal's public page. */ opensHere: boolean };

/** The eight types of Portal's public page (`isFieldReport`), the three that come first on top. */
export const REPORT_TYPE_OPTIONS: readonly ReportTypeOption[] = [
  { code: 'CTL-IMP', label: 'Control de imprimación', caption: 'Tasa de riego por tramo, con bandejas y fotos', opensHere: true },
  { code: 'IAA', label: 'Área adicional', caption: 'Zonas medidas sobre la foto', opensHere: false },
  { code: 'CTL-PIS', label: 'Control de pista', caption: 'Llegada, temperaturas, escantillón y 4 fotos por volquete', opensHere: true },
  { code: 'CON-CAP', label: 'Conformación de capa', caption: 'Espesor y compactación en campo', opensHere: false },
  { code: 'RCP-CAM', label: 'Recepción de campo', caption: 'Conformidad con firma de supervisión', opensHere: false },
  { code: 'LEV-OBS', label: 'Levantamiento de observaciones', caption: 'Correcciones validadas en campo', opensHere: false },
  { code: 'FRE-PAV', label: 'Fresado de pavimento', caption: 'Área fresada y profundidad', opensHere: false },
  { code: 'SOL-IMP', label: 'Solicitud de imprimación', caption: 'Pedido previo al riego, con firma', opensHere: false },
];

const DRAFT_LABEL = 'borrador';

/** A draft of a type filled here reopens its document; its row used to offer only the PDF (José 06/11). Anything else keeps its sheet. */
export function draftToContinue(detail: Pick<ServiceDetail, 'reports'>, id: string): { type: string; reportId: string } | null {
  const report = detail.reports.find((one) => one.id === id);
  if (report?.status.label.toLowerCase() !== DRAFT_LABEL) return null;
  const option = REPORT_TYPE_OPTIONS.find((one) => one.opensHere && (report.typeLabel === one.label || report.title.startsWith(one.label)));
  return option ? { type: option.code, reportId: report.id } : null;
}

/** Who keeps the report: the «está trabajando…» card names it before Portal answers. */
export const REPORT_KEEPER = 'Portal';
const PERCENT = 100;

/** The type's name for the screen's kicker before Portal answers the document. */
export const reportTypeLabel = (code: string): string => REPORT_TYPE_OPTIONS.find((option) => option.code === code)?.label ?? code;
export const DRAFT_FAILED = 'No se pudo abrir el informe';

export const reportDraftPath = (spaceId: string, clientId: string, serviceId: string): string => `${clientServicePath(spaceId, clientId, serviceId)}/reports/draft`;
export const reportFormsPath = (spaceId: string, clientId: string, serviceId: string): string => `${clientServicePath(spaceId, clientId, serviceId)}/reports/forms`;

export type ReportDraftRequest = { type: string; report_id?: string; /** A window of items past the first (50 units a page): the first goes without it. */ page?: number };
/** Without the id Portal answers the person's own draft of that type, so a lost id is never a second report. */
export const reportDraftRequest = (type: string, reportId: string | null, page = 1): ReportDraftRequest => ({ type, ...(reportId ? { report_id: reportId } : {}), ...(page > 1 ? { page } : {}) });

export type ReportDraftBody = { document?: unknown; error?: string; message?: string };
export type ReportDraftResult = { ok: true; document: FieldDocument } | { ok: false; message: string };

/** `null` body = no network or a refusal without a message. */
export function readReportDraft(body: ReportDraftBody | null): ReportDraftResult {
  const document = body?.document !== undefined ? fieldDocumentOf(body.document) : null;
  return document ? { ok: true, document } : { ok: false, message: body?.message ?? DRAFT_FAILED };
}

/** Where and when a photo was taken; the place may be missing, the hour may not (server `placeOf`). */
export type DevicePlace = { lat?: number; lng?: number; at: string };
/** The button under a place field (José, 06/11). */
export const PLACE_BUTTON = { take: 'Usar mi ubicación', taking: 'Buscando tu ubicación…', failed: 'No se pudo leer tu ubicación. Revisa el permiso y el GPS.' };
/** What a place field holds: the same link to the map the service's own place has. */
export const placeFieldValue = ({ lat, lng }: DevicePlace): string | null => (lat === undefined || lng === undefined ? null : locationMapLink({ lat, lng }));
export type SectionFormRequest = { kind: 'section'; type: string; section_id: string; item_id: string | null; key: string; report_id?: string; forms: number; /** The save's own key: Portal tells a photo sent twice from a second one. */ client_key?: string } & Partial<DevicePlace>;
export type PublishFormRequest = { kind: 'publish'; report_id: string; forms: number };
export type RemovePhotoRequest = { kind: 'remove_photo'; report_id: string; photo_id: string; forms: number };
export type ReportFormRequest = SectionFormRequest | PublishFormRequest | RemovePhotoRequest | DriveUploadRequest | WorkProgressRequest | WorkStreetRequest | WorkStreetDeleteRequest | ServiceLinkRequest | WorkScopeRequest | WorkScopeDeleteRequest | WorkStageRequest | WorkTagRequest | WorkRestoreRequest | WorkDeletedRequest | WorkManualProgressRequest | WorkProgressLinkRequest | WorkImportRequest | WorkProgressPdfRequest | WorkMapInReportRequest | PhotoPhaseRequest | LayerEditRequest | LayerDeleteRequest;

/** What `POST …/reports/forms` takes to open a section: its path, the report once it exists, and what this app can draw. */
export function sectionFormRequest(document: FieldDocument, path: SectionPath, place?: DevicePlace | null, clientKey?: string): SectionFormRequest {
  return { kind: 'section', type: document.type, section_id: path.sectionId, item_id: path.itemId, key: path.key, ...(document.id ? { report_id: document.id } : {}), forms: FORMS_LEVEL, ...(place ?? {}), ...(clientKey ? { client_key: clientKey } : {}) };
}

export const removePhotoRequest = (reportId: string, photoId: string): RemovePhotoRequest => ({ kind: 'remove_photo', report_id: reportId, photo_id: photoId, forms: FORMS_LEVEL });

export const publishFormRequest = (document: FieldDocument): PublishFormRequest | null => (document.id ? { kind: 'publish', report_id: document.id, forms: FORMS_LEVEL } : null);

export type StateBadge = { label: string; tone: DetailTone };
const PENDING_BADGE: StateBadge = { label: 'Pendiente de enviar', tone: 'warn' };
const STATE_BADGES: Record<SectionState, StateBadge> = { done: { label: 'Lista', tone: 'ok' }, partial: { label: 'A medias', tone: 'warn' }, error: { label: 'Error', tone: 'error' }, empty: { label: 'Falta', tone: 'error' } };
const OPTIONAL_BADGE: StateBadge = { label: 'Opcional', tone: 'neutral' };
export const STATUS_BADGE: Record<DocumentStatus, StateBadge> = { draft: { label: 'Borrador', tone: 'warn' }, published: { label: 'Publicado', tone: 'ok' } };

/** The pill of a section card (design j-02): an empty section nobody owes is «Opcional», not «Falta»; one waiting in the queue says so. */
export function sectionBadge(state: SectionState, required: boolean, pending?: string): StateBadge {
  if (pending && state !== 'error') return PENDING_BADGE;
  return state === 'empty' && !required ? OPTIONAL_BADGE : STATE_BADGES[state];
}

export const progressLine = ({ done, total }: { done: number; total: number }): string => `${done} de ${total} ${total === 1 ? 'sección lista' : 'secciones listas'}`;
export const progressPercent = ({ done, total }: { done: number; total: number }): number => (total ? Math.round((done / total) * PERCENT) : 0);

/** «1 tramo», «2 tramos» or none yet, in the repeat's own word. */
export function itemsLine(section: RepeatSection): string {
  const unit = section.itemTitle.toLowerCase();
  const count = section.items.length;
  if (count === 0) return `Sin ${pluralOf(unit)} todavía`;
  return `${count} ${count === 1 ? unit : pluralOf(unit)}`;
}

/** «tramo» → «tramos», «unidad» → «unidades». */
const pluralOf = (word: string): string => (/[aeiouáéíóú]$/i.test(word) ? `${word}s` : `${word}es`);

/** «Página 2 de 3» over a paged repeat (design j-05); nothing while all the items fit. */
export const pageLine = ({ page }: Pick<RepeatSection, 'page'>): string | null => (page && page.total > 1 ? `Página ${page.current} de ${page.total}` : null);

export const PUBLISH_LABEL = 'Publicar informe';
export type TrackStart = { appName: string; command: string; action: string };
/** What each platform lends: its `track` of app answers and its HTTP call to `reports/forms`. */
export type ReportFormDeps<T> = { track: (start: TrackStart, call: () => Promise<T>) => Promise<boolean>; open: (request: ReportFormRequest) => Promise<T> };

/** «Publicar» as a form of the app, the same on the phone and the web. The sections go through the queue (`reportQueue`). */
export function openPublishForm<T>(deps: ReportFormDeps<T>, report: FieldDocument): Promise<boolean> {
  const request = publishFormRequest(report);
  return request ? deps.track({ appName: REPORT_KEEPER, command: '', action: PUBLISH_LABEL }, () => deps.open(request)) : Promise.resolve(false);
}

/** What the screen draws: the document once it came, and the repeat whose items are open, if any. */
export function reportViewOf(draft: ReportDraftResult | null, itemsOf: string | null): { report: FieldDocument | null; items: DocumentSection | undefined } {
  const report = draft?.ok ? draft.document : null;
  return { report, items: report?.sections.find((section) => section.id === itemsOf) };
}

/** What a report no longer needs on screen: every answered form but the newest. One still running or refused stays. */
export function staleAnswerIds(answers: readonly Pick<EphemeralAnswer, 'commandId' | 'state'>[]): string[] {
  return answers.slice(0, -1).filter((answer) => answer.state === 'answered').map((answer) => answer.commandId);
}

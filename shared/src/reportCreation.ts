import { FORMS_LEVEL } from './appForms.js';
import type { EphemeralAnswer } from './botCommands.js';
import { fieldDocumentOf, SECTION_TOOL, sectionFormOf, type DocumentSection, type DocumentStatus, type FieldDocument, type RepeatSection, type SectionPath, type SectionState } from './fieldDocument.js';
import { clientServicePath } from './serviceAsk.js';
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
  { code: 'CTL-PIS', label: 'Control de pista', caption: 'Una foto por volquete del pedido', opensHere: false },
  { code: 'CON-CAP', label: 'Conformación de capa', caption: 'Espesor y compactación en campo', opensHere: false },
  { code: 'RCP-CAM', label: 'Recepción de campo', caption: 'Conformidad con firma de supervisión', opensHere: false },
  { code: 'LEV-OBS', label: 'Levantamiento de observaciones', caption: 'Correcciones validadas en campo', opensHere: false },
  { code: 'FRE-PAV', label: 'Fresado de pavimento', caption: 'Área fresada y profundidad', opensHere: false },
  { code: 'SOL-IMP', label: 'Solicitud de imprimación', caption: 'Pedido previo al riego, con firma', opensHere: false },
];

/** Who keeps the report: the «está trabajando…» card names it before Portal answers. */
export const REPORT_KEEPER = 'Portal';
const PERCENT = 100;

/** The type's name for the screen's kicker before Portal answers the document. */
export const reportTypeLabel = (code: string): string => REPORT_TYPE_OPTIONS.find((option) => option.code === code)?.label ?? code;
const DRAFT_FAILED = 'No se pudo abrir el informe';

export const reportDraftPath = (spaceId: string, clientId: string, serviceId: string): string => `${clientServicePath(spaceId, clientId, serviceId)}/reports/draft`;
export const reportFormsPath = (spaceId: string, clientId: string, serviceId: string): string => `${clientServicePath(spaceId, clientId, serviceId)}/reports/forms`;

export type ReportDraftRequest = { type: string; report_id?: string };
/** Without the id Portal answers the person's own draft of that type, so a lost id is never a second report. */
export const reportDraftRequest = (type: string, reportId: string | null): ReportDraftRequest => ({ type, ...(reportId ? { report_id: reportId } : {}) });

export type ReportDraftBody = { document?: unknown; error?: string; message?: string };
export type ReportDraftResult = { ok: true; document: FieldDocument } | { ok: false; message: string };

/** `null` body = no network or a refusal without a message. */
export function readReportDraft(body: ReportDraftBody | null): ReportDraftResult {
  const document = body?.document !== undefined ? fieldDocumentOf(body.document) : null;
  return document ? { ok: true, document } : { ok: false, message: body?.message ?? DRAFT_FAILED };
}

/** Where and when a photo was taken; the place may be missing, the hour may not (server `placeOf`). */
export type DevicePlace = { lat?: number; lng?: number; at: string };
export type SectionFormRequest = { kind: 'section'; type: string; section_id: string; item_id: string | null; key: string; report_id?: string; forms: number } & Partial<DevicePlace>;
export type PublishFormRequest = { kind: 'publish'; report_id: string; forms: number };
export type ReportFormRequest = SectionFormRequest | PublishFormRequest;

/** What `POST …/reports/forms` takes to open a section: its path, the report once it exists, and what this app can draw. */
export function sectionFormRequest(document: FieldDocument, path: SectionPath, place?: DevicePlace | null): SectionFormRequest {
  return { kind: 'section', type: document.type, section_id: path.sectionId, item_id: path.itemId, key: path.key, ...(document.id ? { report_id: document.id } : {}), forms: FORMS_LEVEL, ...(place ?? {}) };
}

export const publishFormRequest = (document: FieldDocument): PublishFormRequest | null => (document.id ? { kind: 'publish', report_id: document.id, forms: FORMS_LEVEL } : null);

/** A section with a tool of its own (the photos) wants the device's place and hour before it opens. */
export function sectionNeedsPlace(document: FieldDocument, path: SectionPath): boolean {
  const form = sectionFormOf(document, path);
  return Boolean(form && form.id !== SECTION_TOOL);
}

export type StateBadge = { label: string; tone: DetailTone };
const STATE_BADGES: Record<SectionState, StateBadge> = { done: { label: 'Lista', tone: 'ok' }, partial: { label: 'A medias', tone: 'warn' }, error: { label: 'Error', tone: 'error' }, empty: { label: 'Falta', tone: 'error' } };
const OPTIONAL_BADGE: StateBadge = { label: 'Opcional', tone: 'neutral' };
export const STATUS_BADGE: Record<DocumentStatus, StateBadge> = { draft: { label: 'Borrador', tone: 'warn' }, published: { label: 'Publicado', tone: 'ok' } };

/** The pill of a section card (design j-02): an empty section nobody owes is «Opcional», not «Falta». */
export const sectionBadge = (state: SectionState, required: boolean): StateBadge => (state === 'empty' && !required ? OPTIONAL_BADGE : STATE_BADGES[state]);

export const progressLine = ({ done, total }: { done: number; total: number }): string => `${done} de ${total} ${total === 1 ? 'sección lista' : 'secciones listas'}`;
export const progressPercent = ({ done, total }: { done: number; total: number }): number => (total ? Math.round((done / total) * PERCENT) : 0);

/** «1 tramo», «2 tramos» or none yet, in the repeat's own word. */
export function itemsLine(section: RepeatSection): string {
  const unit = section.itemTitle.toLowerCase();
  const count = section.items.length;
  if (count === 0) return `Sin ${unit}s todavía`;
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

const PUBLISH_LABEL = 'Publicar informe';
export type TrackStart = { appName: string; command: string; action: string };
/** What each platform lends: its `track` of app answers, its HTTP call to `reports/forms` and its way to read where the device is. */
export type ReportFormDeps<T> = { track: (start: TrackStart, call: () => Promise<T>) => Promise<boolean>; open: (request: ReportFormRequest) => Promise<T>; placeNow: () => Promise<DevicePlace> };

/** Opening a section or «Publicar» as a form of the app, the same on the phone and the web: the place only for the photos. */
export function reportFormActions<T>(deps: ReportFormDeps<T>) {
  const openSection = async (report: FieldDocument, path: SectionPath): Promise<boolean> => {
    const place = sectionNeedsPlace(report, path) ? await deps.placeNow() : null;
    const request = sectionFormRequest(report, path, place);
    const title = sectionFormOf(report, path)?.title ?? path.key;
    return deps.track({ appName: REPORT_KEEPER, command: '', action: title }, () => deps.open(request));
  };
  const openPublish = (report: FieldDocument): Promise<boolean> => {
    const request = publishFormRequest(report);
    return request ? deps.track({ appName: REPORT_KEEPER, command: '', action: PUBLISH_LABEL }, () => deps.open(request)) : Promise.resolve(false);
  };
  return { openSection, openPublish };
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

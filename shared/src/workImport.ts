import { FORMS_LEVEL } from './appForms.js';
import { metersLabel } from './workMap.js';
import { sendMapTool, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * «Importar KMZ o KML» (design o-12, Portal abc01353): a file already in the service's Drive is
 * read by Portal; first it says which lines it found, then the person confirms and they become
 * streets. A resend with the same `entry_id` creates nothing twice. PURE: the web and the APK use it.
 */
export type WorkImportRequest = { kind: 'work_import'; media_id: string; confirm: boolean; entry_id?: string; forms: number };
export type ImportLine = { name: string; length: string };
export type ImportSkipped = { name: string; reason: string };
export type ImportReview = { lines: ImportLine[]; skipped: ImportSkipped[] };
/** A trace file to the service's Drive first: Portal reads it from there. */
export type TraceUpload<F> = (file: F) => Promise<{ ok: true; mediaId: string } | { ok: false; message: string }>;
export const IMPORT_NOT_A_TRACE = 'Elige un archivo .kmz o .kml.';
export type ImportResult = { ok: true; review: ImportReview } | { ok: false; message: string };

export const IMPORT_FAILED = 'No se pudo leer el archivo. Revisa tu señal y vuelve a intentarlo.';
export const IMPORT_NOTHING = 'El archivo no trae líneas que se puedan usar como calles.';
export const KMZ_TYPE = 'application/vnd.google-earth.kmz';
export const KML_TYPE = 'application/vnd.google-earth.kml+xml';
const LINES_MAX = 200;

/** Phones and browsers often do not know a .kmz: the name decides. */
export function importFileType(name: string, type: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.kmz')) return KMZ_TYPE;
  if (lower.endsWith('.kml')) return KML_TYPE;
  return type === KMZ_TYPE || type === KML_TYPE ? type : null;
}

export const workImportRequest = (mediaId: string, entryId?: string): WorkImportRequest =>
  ({ kind: 'work_import', media_id: mediaId, confirm: Boolean(entryId), ...(entryId ? { entry_id: entryId } : {}), forms: FORMS_LEVEL });

type Raw = Record<string, unknown>;
const listOf = (value: unknown): Raw[] => (Array.isArray(value) ? value.filter((one): one is Raw => Boolean(one) && typeof one === 'object') : []);
const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const lengthOf = (value: unknown): string => (typeof value === 'number' && Number.isFinite(value) ? metersLabel(value) : '');

/** Portal's review (`calles`) or its result (`creadas`), read by a whitelist. */
export function importReviewOf(data: Raw | undefined): ImportReview {
  const found = listOf(data?.calles ?? data?.creadas).slice(0, LINES_MAX);
  return {
    lines: found.map((line) => ({ name: textOf(line.nombre) || 'Sin nombre', length: lengthOf(line.largoM) })),
    skipped: listOf(data?.omitidas).map((line) => ({ name: textOf(line.nombre) || 'Sin nombre', reason: textOf(line.motivo) })),
  };
}

async function runImport(send: MapEditSend, request: WorkImportRequest): Promise<ImportResult> {
  const result: WorkProgressResult = await send(request, (deps) => sendMapTool(deps, {}, { sent: '', failed: IMPORT_FAILED }));
  return result.ok ? { ok: true, review: importReviewOf(result.data) } : result;
}

/** «Revisar»: what Portal read in the file; nothing is written. */
export async function reviewImport(send: MapEditSend, mediaId: string): Promise<ImportResult> {
  const read = await runImport(send, workImportRequest(mediaId));
  return read.ok && !read.review.lines.length ? { ok: false, message: IMPORT_NOTHING } : read;
}

/** «Crear calles»: the same `entryId` on a retry creates only what is missing. */
export const confirmImport = (send: MapEditSend, mediaId: string, entryId: string): Promise<ImportResult> => runImport(send, workImportRequest(mediaId, entryId));

export const importCreateLabel = (count: number): string => (count === 1 ? 'Crear 1 calle' : `Crear ${count} calles`);
export const importDoneLabel = (count: number): string => (count === 1 ? 'Se creó 1 calle.' : `Se crearon ${count} calles.`);

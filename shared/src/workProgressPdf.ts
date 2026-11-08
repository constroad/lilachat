import { FORMS_LEVEL } from './appForms.js';
import type { WorkMapFilter } from './workMap.js';
import { sendMapTool, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * The PDFs of the map (Portal 02cfceef): «Descargar PDF para cliente» (o-08, an A4 with the plan,
 * the summary and the approved total) and «Plano PDF» (o-12, A3 or A1 landscape with the table of
 * metres), at the cut the panel shows. Portal answers the link in the same call. PURE.
 */
export type ProgressPdfFormat = 'client' | 'plan';
export type PlanSize = 'A3' | 'A1';
export type WorkProgressPdfRequest = { kind: 'work_progress_pdf'; stage_id?: string; until?: string; format: ProgressPdfFormat; size?: PlanSize; work_ids?: string[]; forms: number };
export type ProgressPdfResult = { ok: true; url: string } | { ok: false; message: string };

export const PROGRESS_PDF_FAILED = 'No se pudo generar el PDF. Revisa tu señal y vuelve a intentarlo.';
export const PROGRESS_PDF_MISSING = 'Portal no devolvió el PDF. Vuelve a intentarlo.';
export const PLAN_SIZES: readonly PlanSize[] = ['A3', 'A1'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function workProgressPdfRequest(filter: WorkMapFilter, format: ProgressPdfFormat, size?: PlanSize): WorkProgressPdfRequest {
  return {
    kind: 'work_progress_pdf',
    ...(filter.stageId ? { stage_id: filter.stageId } : {}),
    ...(filter.untilDay && DAY.test(filter.untilDay) ? { until: filter.untilDay } : {}),
    format,
    ...(format === 'plan' && size ? { size } : {}),
    ...(format === 'plan' && filter.workId ? { work_ids: [filter.workId] } : {}),
    forms: FORMS_LEVEL,
  };
}

/** Portal's `{status:'ready', url}`; only an https link is opened. */
export const progressPdfUrlOf = (data: Record<string, unknown> | undefined): string | null =>
  (data?.status === 'ready' && typeof data.url === 'string' && data.url.startsWith('https://') ? data.url : null);

export async function createProgressPdf(send: MapEditSend, filter: WorkMapFilter, format: ProgressPdfFormat, size?: PlanSize): Promise<ProgressPdfResult> {
  const result: WorkProgressResult = await send(workProgressPdfRequest(filter, format, size), (deps) => sendMapTool(deps, {}, { sent: '', failed: PROGRESS_PDF_FAILED }));
  if (!result.ok) return result;
  const url = progressPdfUrlOf(result.data);
  return url ? { ok: true, url } : { ok: false, message: PROGRESS_PDF_MISSING };
}

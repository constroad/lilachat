import { FORMS_LEVEL } from './appForms.js';
import type { WorkMapFilter } from './workMap.js';
import { sendMapTool, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * The PDFs of the map (Portal 02cfceef): «Descargar PDF para cliente» (o-08, an A4 with the plan,
 * the summary and the approved total) and «Plano PDF» (o-12, A3 or A1 landscape with the table of
 * metres), at the cut the panel shows. A sheet takes ~30 s: Portal answers «generating» with a wait,
 * and the same form asked again gets the link (Portal ed331de6; a ready PDF is reused 10 min). PURE.
 */
export type ProgressPdfFormat = 'client' | 'plan';
export type PlanSize = 'A3' | 'A1';
export type WorkProgressPdfRequest = { kind: 'work_progress_pdf'; stage_id?: string; until?: string; format: ProgressPdfFormat; size?: PlanSize; work_ids?: string[]; forms: number };
export type ProgressPdfResult = { ok: true; url: string } | { ok: false; message: string };

export const PROGRESS_PDF_FAILED = 'No se pudo generar el PDF. Revisa tu señal y vuelve a intentarlo.';
export const PROGRESS_PDF_MISSING = 'Portal no devolvió el PDF. Vuelve a intentarlo.';
export const PLAN_SIZES: readonly PlanSize[] = ['A3', 'A1'];
export const PROGRESS_PDF_SLOW = 'El PDF sigue generándose. Prueba otra vez en un minuto.';
/** agentes: 20 calls a minute per person; six asks every ~10 s stay far below and cover a slow sheet. */
export const PROGRESS_PDF_MAX_TRIES = 6;
const RETRY_MIN_S = 2;
const RETRY_MAX_S = 30;
const RETRY_DEFAULT_S = 10;
const MS_PER_S = 1000;
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

/** Seconds to wait when Portal is still making it; null when the answer is neither ready nor that. */
export function progressPdfWaitOf(data: Record<string, unknown> | undefined): number | null {
  if (data?.status !== 'generating') return null;
  const asked = typeof data.retry_after_s === 'number' && Number.isFinite(data.retry_after_s) ? data.retry_after_s : RETRY_DEFAULT_S;
  return Math.min(RETRY_MAX_S, Math.max(RETRY_MIN_S, Math.round(asked)));
}

const pause = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

/** Asks, and while Portal says «generating», waits and asks again with the same values. */
export async function createProgressPdf(send: MapEditSend, filter: WorkMapFilter, format: ProgressPdfFormat, size?: PlanSize, wait: (ms: number) => Promise<void> = pause): Promise<ProgressPdfResult> {
  const request = workProgressPdfRequest(filter, format, size);
  for (let tries = 1; ; tries += 1) {
    const result: WorkProgressResult = await send(request, (deps) => sendMapTool(deps, {}, { sent: '', failed: PROGRESS_PDF_FAILED }));
    if (!result.ok) return result;
    const url = progressPdfUrlOf(result.data);
    if (url) return { ok: true, url };
    const seconds = progressPdfWaitOf(result.data);
    if (seconds === null) return { ok: false, message: PROGRESS_PDF_MISSING };
    if (tries >= PROGRESS_PDF_MAX_TRIES) return { ok: false, message: PROGRESS_PDF_SLOW };
    await wait(seconds * MS_PER_S);
  }
}

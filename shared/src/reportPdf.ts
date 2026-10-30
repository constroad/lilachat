/**
 * A report's PDF asked on demand (agentes 30/10, Portal 588e3ff9:
 * `client.report.requested`): Portal answers ready with a lila link, or
 * generating with how long to wait. The app or the web asks again after that
 * wait, a few times at most; each ask is a new delivery. PURE.
 */
export type ReportPdf = { status: 'ready'; pdfUrl: string } | { status: 'generating'; retryAfterS: number };
/** What the server answers the app or the web. */
export type ReportPdfBody = { pdf?: ReportPdf; message?: string };
export type ReportPdfStep = { kind: 'open'; url: string } | { kind: 'wait'; ms: number } | { kind: 'failed'; message: string };

/** agentes: «como mucho unos 6 reintentos»; a report with many photos may take several. */
export const REPORT_PDF_MAX_TRIES = 6;
export const REPORT_PDF_FAILED = 'No se pudo traer el PDF del informe';
const STILL_GENERATING = 'El PDF sigue generándose en el Portal. Prueba otra vez en unos minutos.';
const RETRY_MIN_S = 1;
const RETRY_MAX_S = 60;
const RETRY_DEFAULT_S = 5;
const MS_PER_S = 1000;

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null);
const waitOf = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.min(RETRY_MAX_S, Math.max(RETRY_MIN_S, Math.round(value))) : RETRY_DEFAULT_S);

/** agentes' 200 body; `null` for anything that is neither. */
export function reportPdfOf(body: unknown): ReportPdf | null {
  const input = record(body);
  if (input?.status === 'ready') return typeof input.pdf_url === 'string' && input.pdf_url.startsWith('https://') ? { status: 'ready', pdfUrl: input.pdf_url } : null;
  if (input?.status === 'generating') return { status: 'generating', retryAfterS: waitOf(input.retry_after_s) };
  return null;
}

/** After the `tries`-th answer: open it, wait and ask again, or say why not. */
export function nextReportPdfStep(body: ReportPdfBody | null, tries: number): ReportPdfStep {
  const pdf = body?.pdf;
  if (pdf?.status === 'ready') return { kind: 'open', url: pdf.pdfUrl };
  if (pdf?.status === 'generating') return tries < REPORT_PDF_MAX_TRIES ? { kind: 'wait', ms: pdf.retryAfterS * MS_PER_S } : { kind: 'failed', message: STILL_GENERATING };
  return { kind: 'failed', message: body?.message ?? REPORT_PDF_FAILED };
}

export const reportPdfPath = (spaceId: string, clientId: string, serviceId: string, reportId: string): string =>
  `/workspaces/${spaceId}/clients/${encodeURIComponent(clientId)}/services/${encodeURIComponent(serviceId)}/reports/${encodeURIComponent(reportId)}/pdf`;

/** Asks until Portal has it or it fails; `null` once `current` says the person closed the sheet. */
export async function askReportPdfUntilDone(ask: () => Promise<ReportPdfBody | null>, current: () => boolean, pause: (ms: number) => Promise<void>): Promise<Exclude<ReportPdfStep, { kind: 'wait' }> | null> {
  for (let tries = 1; current(); tries += 1) {
    const step = nextReportPdfStep(await ask(), tries);
    if (!current()) return null;
    if (step.kind !== 'wait') return step;
    await pause(step.ms);
  }
  return null;
}

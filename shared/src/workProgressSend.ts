import { FORMS_LEVEL, type FormValues } from './appForms.js';
import type { FormSubmitReply } from './appActions.js';
import type { CommandNotice, CommandOutcome } from './botCommands.js';
import type { ProgressEntry } from './workMapProgress.js';

/**
 * «Confirmar avance» of the map (design o-07, agentes 07/11). `registrar_avance_de_obra` has no
 * shortcut: the server opens it like `subir_al_drive`, puts the service from its door and the
 * lists in the context, and the form only carries the note. PURE: the APK and the web send it.
 */
export type WorkProgressRequest = {
  kind: 'work_progress';
  street_id: string;
  tag_id?: string;
  partida_id?: string;
  from_m: number;
  to_m: number;
  dispatch_ids: string[];
  entry_id: string;
  device_at: string;
  forms: number;
};
export type WorkProgressDeps = {
  open(): Promise<{ ok: true; data: CommandOutcome } | { ok: false; message?: string }>;
  submit(commandId: string, values: FormValues): Promise<FormSubmitReply>;
  notice(commandId: string): Promise<CommandNotice | null>;
};
export type WorkProgressResult = { ok: true; message: string } | { ok: false; message: string };

export const PROGRESS_SENT = 'Avance registrado. Queda pendiente de aprobación del residente.';
export const PROGRESS_FAILED = 'No se pudo registrar el avance. Revisa tu señal y vuelve a confirmar.';

export const workProgressRequest = (entry: ProgressEntry): WorkProgressRequest => ({
  kind: 'work_progress',
  street_id: entry.calleId,
  ...(entry.etiquetaId ? { tag_id: entry.etiquetaId } : {}),
  ...(entry.partidaId ? { partida_id: entry.partidaId } : {}),
  from_m: entry.desdeM,
  to_m: entry.hastaM,
  dispatch_ids: entry.despachoIds,
  entry_id: entry.entradaId,
  device_at: entry.horaDelEquipo,
  forms: FORMS_LEVEL,
});

type MapToolTexts = { sent: string; failed: string };

function refusalOf(reply: Extract<FormSubmitReply, { ok: false }>, failed: string): string {
  const said = reply.errors?._ ?? Object.values(reply.errors ?? {})[0] ?? reply.message ?? failed;
  return reply.code === 'rate_limited' && reply.retryAfterS ? `${said} Espera ${reply.retryAfterS} s y vuelve a confirmar.` : said;
}

/** One of Portal's map tools, opened by the server's door and confirmed with `values` (o-02, o-07). */
export async function sendMapTool(deps: WorkProgressDeps, values: FormValues, texts: MapToolTexts): Promise<WorkProgressResult> {
  const opened = await deps.open();
  if (!opened.ok) return { ok: false, message: opened.message ?? texts.failed };
  const { commandId } = opened.data;
  const reply = await deps.submit(commandId, values);
  if (!reply.ok) return { ok: false, message: refusalOf(reply, texts.failed) };
  const { outcome } = reply;
  if (outcome.outcome === 'failed') return { ok: false, message: outcome.message ?? texts.failed };
  const response = outcome.outcome === 'pending' ? (await deps.notice(commandId))?.response : outcome.response;
  return { ok: true, message: response?.text?.trim() || texts.sent };
}

/** The same `entradaId` on a resend: Portal answers `ya_marcada` and agentes turns it into a normal answer, «Ya estaba registrado.». */
export const sendWorkProgress = (deps: WorkProgressDeps, entry: ProgressEntry): Promise<WorkProgressResult> =>
  sendMapTool(deps, entry.nota ? { nota: entry.nota } : {}, { sent: PROGRESS_SENT, failed: PROGRESS_FAILED });

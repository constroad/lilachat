import { FORMS_LEVEL } from './appForms.js';
import type { FormSubmitReply } from './appActions.js';
import type { CommandResponse } from './botCommands.js';
import { driveFileRefusal, formRunAnswer, uploadFailure, type DriveFileFacts, type DriveUpload, type FormRunDeps } from './driveUpload.js';
import { LIFTING_TYPE, OBSERVATION_NOTE_MAX, REGISTRY_TYPE, type ObservationDocument } from './observations.js';
import type { WorkMapPoint } from './workMap.js';

/**
 * Registering and lifting an observation (Portal ead85b1a, agentes 506f753,
 * 11/11/2026). Each write is a form run of the client's app: Portal answers its
 * ids and a ticket, and every photo or video goes from the phone straight to
 * Portal with it, like the Drive (`driveUpload`). The entry's key makes a
 * repeat land on the same observation. PURE.
 */
export type ObservationRegisterRequest = { kind: 'observation_register'; entry_id: string; lat: number; lng: number; precision_m?: number; source: ObservationSource; report_id?: string; forms: number };
/** Where it was registered from (Portal 56dce11c): an iPhone's PWA is the web. */
export type ObservationSource = 'apk' | 'web';
const PRECISION_MAX_M = 5000;
export type ObservationLiftRequest = { kind: 'observation_lift'; observation_id: string; report_id?: string; forms: number };
type ReportOf = Pick<ObservationDocument, 'id' | 'type'> | null;

/** The registry's id goes only from a registry: from a lifting, Portal files it in the service's open registry. */
export const registerRequest = (report: ReportOf, entryId: string, place: WorkMapPoint & { precision?: number }, source: ObservationSource): ObservationRegisterRequest => ({
  kind: 'observation_register', entry_id: entryId, lat: place.lat, lng: place.lng, ...precisionOf(place.precision), source, ...(report?.id && report.type === REGISTRY_TYPE ? { report_id: report.id } : {}), forms: FORMS_LEVEL,
});

/** The GPS's «±N m», whole meters, only when the phone gave a sane one. */
const precisionOf = (meters: number | undefined): { precision_m?: number } => (meters !== undefined && Number.isFinite(meters) && meters >= 0 && meters <= PRECISION_MAX_M ? { precision_m: Math.round(meters) } : {});

/** The lifting's id goes only from a lifting: from the registry, Portal files it in the service's open lifting. */
export const liftRequest = (report: ReportOf, observationId: string): ObservationLiftRequest => ({
  kind: 'observation_lift', observation_id: observationId, ...(report?.id && report.type === LIFTING_TYPE ? { report_id: report.id } : {}), forms: FORMS_LEVEL,
});

/** A blank note goes as nothing: Portal writes «Observación registrada en campo, sin nota.» (José 11/11). */
export function noteValues(note: string): { nota?: string } {
  const nota = note.trim().slice(0, OBSERVATION_NOTE_MAX);
  return nota ? { nota } : {};
}

export type ObservationAnswer = { reportId: string; observationId: string; code?: string; upload: DriveUpload | null };

/** Portal's `structuredContent` rides as `data`; the ticket comes apart (agentes 506f753). */
export function observationAnswerOf(response: CommandResponse): ObservationAnswer | null {
  const data = response.data ?? {};
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  const [reportId, observationId, code] = [text(data.informeId), text(data.observacionId), text(data.codigo)];
  return reportId && observationId ? { reportId, observationId, ...(code ? { code } : {}), upload: response.upload ?? null } : null;
}

/** One photo or video; its key is its `clientUploadId`, so a retry never makes a second copy. */
export type EvidenceFile<F> = { key: string; source: F; facts: DriveFileFacts };
export type ObservationWriteDeps<F> = Pick<FormRunDeps, 'open' | 'notice'> & {
  submit(commandId: string, values: Record<string, string>): Promise<FormSubmitReply>;
  send(upload: DriveUpload, file: F, clientUploadId: string): Promise<{ status?: number; message?: string; mediaId?: string }>;
  progress?(sent: number, total: number): void;
};
export type ObservationWriteResult = { ok: true; answer: ObservationAnswer; failed: { key: string; message: string }[] } | { ok: false; message: string };

export const OBSERVATION_WRITE_FAILED = 'No se pudo guardar la observación. Revisa tu señal y vuelve a intentarlo.';
const NO_TICKET = 'No llegó el permiso para subir el archivo. Vuelve a intentarlo.';
const EXPIRED = 410;
const TICKET_TRIES = 2;
const SUCCESS_BELOW = 300;

async function confirm<F>(deps: ObservationWriteDeps<F>, values: Record<string, string>): Promise<ObservationAnswer | { message: string }> {
  const answer = await formRunAnswer({ open: deps.open, notice: deps.notice, submit: (commandId) => deps.submit(commandId, values) }, OBSERVATION_WRITE_FAILED);
  if ('message' in answer) return answer;
  return observationAnswerOf(answer.response) ?? { message: OBSERVATION_WRITE_FAILED };
}

/** One file with the ticket in hand. A 410 confirms again (same entry, same ids) for a fresh ticket, once. */
async function sendOne<F>(deps: ObservationWriteDeps<F>, values: Record<string, string>, ticket: { upload: DriveUpload | null }, file: EvidenceFile<F>): Promise<string | null> {
  for (let attempt = 0; attempt < TICKET_TRIES; attempt += 1) {
    if (!ticket.upload) return NO_TICKET;
    const refusal = driveFileRefusal(ticket.upload, file.facts);
    if (refusal) return refusal;
    const { status, message } = await deps.send(ticket.upload, file.source, file.key);
    if (status && status < SUCCESS_BELOW) return null;
    if (status !== EXPIRED) return uploadFailure(status, message);
    const again = await confirm(deps, values);
    if ('message' in again) return again.message;
    ticket.upload = again.upload;
  }
  return uploadFailure(EXPIRED);
}

/**
 * Writes the observation, then its files one by one. A file that fails is
 * reported and the rest still go; calling it again with the same request and
 * files sends only what Portal does not have yet.
 */
export async function writeObservation<F>(deps: ObservationWriteDeps<F>, note: string, files: readonly EvidenceFile<F>[]): Promise<ObservationWriteResult> {
  const values = noteValues(note);
  const answer = await confirm(deps, values);
  if ('message' in answer) return { ok: false, message: answer.message };
  const ticket = { upload: answer.upload };
  const failed: { key: string; message: string }[] = [];
  for (const [index, file] of files.entries()) {
    const message = await sendOne(deps, values, ticket, file);
    if (message) failed.push({ key: file.key, message });
    deps.progress?.(index + 1, files.length);
  }
  return { ok: true, answer, failed };
}

export const OBSERVATION_GPS_MISSING = 'No se pudo leer tu ubicación. Revisa el permiso y el GPS.';

/** What the screen says after a write: done, or which files still have to go (the same entry sends only those). */
export function writeOutcome(result: ObservationWriteResult, done: string): { done: boolean; line: string } {
  if (!result.ok) return { done: false, line: result.message };
  const who = result.answer.code ?? 'La observación';
  const count = result.failed.length;
  if (!count) return { done: true, line: `${who} ${done}.` };
  return { done: false, line: `${who} ${done}; ${count === 1 ? 'falta 1 archivo' : `faltan ${count} archivos`}: ${result.failed[0]!.message}` };
}

export type ObservationWriteState = { busy: boolean; line: string | null };

/**
 * One screen's write and what it says, for the APK and the web alike. `run`
 * answers the report's id when everything landed, else null; the same deps
 * again send only what Portal does not have yet. No deps: the GPS is missing.
 */
export function observationWriteStore() {
  let state: ObservationWriteState = { busy: false, line: null };
  const listeners = new Set<() => void>();
  const set = (next: ObservationWriteState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function run<F>(deps: ObservationWriteDeps<F> | null, note: string, files: readonly EvidenceFile<F>[], done: string): Promise<string | null> {
    if (!deps) {
      set({ busy: false, line: OBSERVATION_GPS_MISSING });
      return null;
    }
    set({ busy: true, line: null });
    const result = await writeObservation({ ...deps, progress: (sent, total) => set({ busy: true, line: `Subiendo ${sent} de ${total}…` }) }, note, files);
    const outcome = writeOutcome(result, done);
    set({ busy: false, line: outcome.line });
    return outcome.done && result.ok ? result.answer.reportId : null;
  }
  return { get: () => state, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, run };
}


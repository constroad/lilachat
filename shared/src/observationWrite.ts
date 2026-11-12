import { FORMS_LEVEL } from './appForms.js';
import type { CommandResponse } from './botCommands.js';
import type { DriveUpload } from './driveUpload.js';
import { formFilesWriteStore, writeWithFiles, writtenOutcome, type EvidenceFile, type FormFilesWriteDeps, type FormFilesWriteResult, type WriteKind, type WriteState } from './formFilesWrite.js';
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

export type { EvidenceFile } from './formFilesWrite.js';
export type ObservationWriteDeps<F> = FormFilesWriteDeps<F>;
export type ObservationWriteResult = FormFilesWriteResult<ObservationAnswer>;

export const OBSERVATION_WRITE_FAILED = 'No se pudo guardar la observación. Revisa tu señal y vuelve a intentarlo.';
const OBSERVATION_WRITE: WriteKind<ObservationAnswer> = { failed: OBSERVATION_WRITE_FAILED, answerOf: observationAnswerOf, who: 'La observación' };

/**
 * Writes the observation, then its files one by one. A file that fails is
 * reported and the rest still go; calling it again with the same request and
 * files sends only what Portal does not have yet.
 */
export const writeObservation = <F>(deps: ObservationWriteDeps<F>, note: string, files: readonly EvidenceFile<F>[]): Promise<ObservationWriteResult> =>
  writeWithFiles(deps, noteValues(note), files, OBSERVATION_WRITE);

export const OBSERVATION_GPS_MISSING = 'No se pudo leer tu ubicación. Revisa el permiso y el GPS.';

/** What the screen says after a write: done, or which files still have to go (the same entry sends only those). */
export const writeOutcome = (result: ObservationWriteResult, done: string): { done: boolean; line: string } => writtenOutcome(result, done, OBSERVATION_WRITE.who);

export type ObservationWriteState = WriteState;

/** One screen's write of an observation (`formFilesWriteStore`); no deps: the GPS is missing. */
export const observationWriteStore = () => formFilesWriteStore(OBSERVATION_WRITE, noteValues, OBSERVATION_GPS_MISSING);

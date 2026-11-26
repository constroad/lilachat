import { retryDelayMs } from './outbox.js';
import type { TimemarkStampAsked } from './appActions.js';

/**
 * What the field writes inside a service without signal (José 26/11, Aucallama):
 * a photo or video to the Drive, «Registrar avance», an observation, a task's
 * evidence. Each one is a FACT with its own key (Portal's `clientUploadId` /
 * `entradaId`), kept on disk with its files copied, and sent when the network
 * comes back. The steps a job already finished (a photo's `mediaId`) are kept,
 * so a retry never repeats them. PURE: the phone gives the disk and the wire.
 */
export const FIELD_JOB_KINDS = ['drive_file', 'map_progress', 'observation', 'task_evidence'] as const;
export type FieldJobKind = (typeof FIELD_JOB_KINDS)[number];

export type FieldJobFile = { key: string; ref: string; name: string; mime: string; sizeBytes?: number; seconds?: number; stamp?: TimemarkStampAsked };
export type FieldJobScope = { spaceId: string; clientId: string; serviceId: string; chatId: string };
export type FieldJob = {
  key: string;
  kind: FieldJobKind;
  scope: FieldJobScope;
  /** What the person reads in the waiting list: «Foto al Drive», «Avance · Jr. Conchucos». */
  label: string;
  payload: Record<string, unknown>;
  files: FieldJobFile[];
  createdAt: number;
  /** Tries that never reached the server: they never give up. */
  attempts: number;
  /** Tries the server answered with a passing failure: these do give up. */
  serverAttempts: number;
  nextAt: number;
  done: Record<string, string>;
  refusal?: string;
};

export type FieldJobVerdict =
  | { outcome: 'done' }
  | { outcome: 'retry'; /** The server answered (busy, rate limit, a generic failure). */ reached: boolean; afterMs?: number; done?: Record<string, string> }
  | { outcome: 'refuse'; message: string; done?: Record<string, string> };

/** A server that answers and keeps failing stops here, so a lasting refusal never loops for hours. */
export const FIELD_JOB_SERVER_TRIES = 8;
export const FIELD_JOB_GAVE_UP = 'No se pudo enviar después de varios intentos. Toca «Reintentar».';

export function newFieldJob(input: Pick<FieldJob, 'key' | 'kind' | 'scope' | 'label' | 'payload' | 'files'> & { now: number }): FieldJob {
  const { now, ...job } = input;
  return { ...job, createdAt: now, attempts: 0, serverAttempts: 0, nextAt: now, done: {} };
}

/** Idempotent by key: a double tap is one job. */
export const enqueueFieldJob = (queue: readonly FieldJob[], job: FieldJob): FieldJob[] => (queue.some((one) => one.key === job.key) ? [...queue] : [...queue, job]);

/** The oldest ready job; one waiting its retry or refused never blocks the rest. */
export const nextFieldJob = (queue: readonly FieldJob[], now: number): FieldJob | null => queue.find((one) => !one.refusal && one.nextAt <= now) ?? null;

function settled(job: FieldJob, verdict: Exclude<FieldJobVerdict, { outcome: 'done' }>, now: number): FieldJob {
  const done = { ...job.done, ...(verdict.done ?? {}) };
  if (verdict.outcome === 'refuse') return { ...job, done, refusal: verdict.message };
  const serverAttempts = job.serverAttempts + (verdict.reached ? 1 : 0);
  if (serverAttempts >= FIELD_JOB_SERVER_TRIES) return { ...job, done, serverAttempts, refusal: FIELD_JOB_GAVE_UP };
  const attempts = job.attempts + 1;
  return { ...job, done, attempts, serverAttempts, nextAt: now + (verdict.afterMs ?? retryDelayMs(attempts)) };
}

export function settleFieldJob(queue: readonly FieldJob[], key: string, verdict: FieldJobVerdict, now: number): FieldJob[] {
  if (verdict.outcome === 'done') return queue.filter((one) => one.key !== key);
  return queue.map((one) => (one.key === key ? settled(one, verdict, now) : one));
}

/** «Reintentar»: back in line now, with the steps it already finished. */
export function retryFieldJob(queue: readonly FieldJob[], key: string, now: number): FieldJob[] {
  return queue.map((one) => {
    if (one.key !== key) return one;
    const { refusal: _refusal, ...rest } = one;
    return { ...rest, attempts: 0, serverAttempts: 0, nextAt: now };
  });
}

/** «Descartar»: out of the queue; its files are handed back to delete. */
export function discardFieldJob(queue: readonly FieldJob[], key: string): { queue: FieldJob[]; dropped: FieldJob | null } {
  return { queue: queue.filter((one) => one.key !== key), dropped: queue.find((one) => one.key === key) ?? null };
}

/** When the next pending job is due, or `null` when nothing waits. */
export function fieldJobsWakeAt(queue: readonly FieldJob[]): number | null {
  const pending = queue.filter((one) => !one.refusal).map((one) => one.nextAt);
  return pending.length ? Math.min(...pending) : null;
}

/** What a service shows: how many wait to go and which were refused. */
export function fieldJobsOfService(queue: readonly FieldJob[], serviceId: string): { waiting: number; refused: FieldJob[] } {
  const mine = queue.filter((one) => one.scope.serviceId === serviceId);
  return { waiting: mine.filter((one) => !one.refusal).length, refused: mine.filter((one) => one.refusal) };
}

/**
 * What one run of a job saw on the wire, to tell «no signal» (retry forever)
 * from «the server said no» (keep it at hand) without each handler guessing.
 * Each step reports what it got; `verdictOf` reads the whole run.
 */
export type FieldRunWatch = {
  open(result: { ok: boolean; status?: number }): void;
  submit(reply: { ok: boolean; status?: number; code?: string; retryAfterS?: number }): void;
  notice(heard: boolean): void;
  send(status: number | undefined): void;
  verdictOf(result: { ok: true } | { ok: false; message: string }, done?: Record<string, string>): FieldJobVerdict;
};

const MS_PER_S = 1_000;
const SERVER_DOWN = 500;
const PASSING_STATUSES: ReadonlySet<number> = new Set([401, 408, 429]);
const passes = (status: number | undefined): boolean => status === undefined || status >= SERVER_DOWN || PASSING_STATUSES.has(status);

export function watchFieldRun(): FieldRunWatch {
  let unreachable = false;
  let passing = false;
  let afterMs: number | undefined;
  const note = (failed: boolean, status: number | undefined) => {
    if (!failed) return;
    if (status === undefined) unreachable = true;
    else if (passes(status)) passing = true;
  };
  return {
    open: (result) => note(!result.ok, result.status),
    submit: (reply) => {
      note(!reply.ok, reply.status);
      if (!reply.ok && reply.code === 'rate_limited') {
        passing = true;
        if (reply.retryAfterS) afterMs = reply.retryAfterS * MS_PER_S;
      }
    },
    // The form was taken but its answer never came: agentes is slow, or the socket dropped.
    notice: (heard) => {
      if (!heard) passing = true;
    },
    send: (status) => note(status === undefined || status >= 300, status),
    verdictOf: (result, done) => {
      const steps = done ? { done } : {};
      if (result.ok) return { outcome: 'done' };
      if (unreachable) return { outcome: 'retry', reached: false, ...steps };
      if (passing) return { outcome: 'retry', reached: true, ...(afterMs ? { afterMs } : {}), ...steps };
      return { outcome: 'refuse', message: result.message, ...steps };
    },
  };
}

/** The strip over a service: how many wait on the phone. */
export const fieldQueueLine = (waiting: number): string =>
  waiting === 1 ? '1 pendiente en el teléfono · sale solo apenas haya señal' : `${waiting} pendientes en el teléfono · salen solos apenas haya señal`;

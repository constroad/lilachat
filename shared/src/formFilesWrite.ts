import type { FormSubmitReply } from './appActions.js';
import type { CommandResponse } from './botCommands.js';
import { driveFileRefusal, formRunAnswer, uploadFailure, type DriveFileFacts, type DriveUpload, type FormRunDeps } from './driveUpload.js';

/**
 * A field write that carries files (an observation 11/11, an additional area
 * 12/11): a form run of the client's app answers its ids and a ticket, and each
 * photo or video goes from the phone straight to Portal with it. The entry's
 * key makes a repeat land on the same record, and a file's key makes a retry
 * send only what Portal does not have yet. PURE.
 */

/** One photo or video; its key is its `clientUploadId`. `fields` ride with it (`captura`, 12/11). */
export type EvidenceFile<F> = { key: string; source: F; facts: DriveFileFacts; fields?: Record<string, string> };
export type WriteAnswer = { reportId: string; code?: string; upload: DriveUpload | null };
export type FormFilesWriteDeps<F> = Pick<FormRunDeps, 'open' | 'notice'> & {
  submit(commandId: string, values: Record<string, string>): Promise<FormSubmitReply>;
  send(upload: DriveUpload, file: F, clientUploadId: string, fields?: Record<string, string>): Promise<{ status?: number; message?: string; mediaId?: string }>;
  progress?(sent: number, total: number): void;
};
export type FormFilesWriteResult<A extends WriteAnswer> = { ok: true; answer: A; failed: { key: string; message: string }[] } | { ok: false; message: string };
/** What differs from one record to another: its failure line, how its answer reads, and its name. */
export type WriteKind<A extends WriteAnswer> = { failed: string; answerOf(response: CommandResponse): A | null; who: string };

const NO_TICKET = 'No llegó el permiso para subir el archivo. Vuelve a intentarlo.';
const EXPIRED = 410;
const TICKET_TRIES = 2;
const SUCCESS_BELOW = 300;

async function confirm<F, A extends WriteAnswer>(deps: FormFilesWriteDeps<F>, values: Record<string, string>, kind: WriteKind<A>): Promise<A | { message: string }> {
  const answer = await formRunAnswer({ open: deps.open, notice: deps.notice, submit: (commandId) => deps.submit(commandId, values) }, kind.failed);
  if ('message' in answer) return answer;
  return kind.answerOf(answer.response) ?? { message: kind.failed };
}

/** One file with the ticket in hand. A 410 confirms again (same entry, same ids) for a fresh ticket, once. */
async function sendOne<F, A extends WriteAnswer>(deps: FormFilesWriteDeps<F>, again: () => Promise<A | { message: string }>, ticket: { upload: DriveUpload | null }, file: EvidenceFile<F>): Promise<string | null> {
  for (let attempt = 0; attempt < TICKET_TRIES; attempt += 1) {
    if (!ticket.upload) return NO_TICKET;
    const refusal = driveFileRefusal(ticket.upload, file.facts);
    if (refusal) return refusal;
    const { status, message } = await deps.send(ticket.upload, file.source, file.key, file.fields);
    if (status && status < SUCCESS_BELOW) return null;
    if (status !== EXPIRED) return uploadFailure(status, message);
    const fresh = await again();
    if ('message' in fresh) return fresh.message;
    ticket.upload = fresh.upload;
  }
  return uploadFailure(EXPIRED);
}

/** Writes the record, then its files one by one. A file that fails is reported and the rest still go. */
export async function writeWithFiles<F, A extends WriteAnswer>(deps: FormFilesWriteDeps<F>, values: Record<string, string>, files: readonly EvidenceFile<F>[], kind: WriteKind<A>): Promise<FormFilesWriteResult<A>> {
  const again = () => confirm(deps, values, kind);
  const answer = await again();
  if ('message' in answer) return { ok: false, message: answer.message };
  const ticket = { upload: answer.upload };
  const failed: { key: string; message: string }[] = [];
  for (const [index, file] of files.entries()) {
    const message = await sendOne(deps, again, ticket, file);
    if (message) failed.push({ key: file.key, message });
    deps.progress?.(index + 1, files.length);
  }
  return { ok: true, answer, failed };
}

/** What the screen says after a write: done, or which files still have to go (the same entry sends only those). */
export function writtenOutcome<A extends WriteAnswer>(result: FormFilesWriteResult<A>, done: string, who: string): { done: boolean; line: string } {
  if (!result.ok) return { done: false, line: result.message };
  const name = result.answer.code ?? who;
  const count = result.failed.length;
  if (!count) return { done: true, line: `${name} ${done}.` };
  return { done: false, line: `${name} ${done}; ${count === 1 ? 'falta 1 archivo' : `faltan ${count} archivos`}: ${result.failed[0]!.message}` };
}

export type WriteState = { busy: boolean; line: string | null };

/**
 * One screen's write and what it says, for the APK and the web alike. `run`
 * answers the report's id when everything landed, else null; the same deps
 * again send only what Portal does not have yet. No deps: `missing` is said.
 */
export function formFilesWriteStore<A extends WriteAnswer, I>(kind: WriteKind<A>, valuesOf: (input: I) => Record<string, string>, missing: string) {
  let state: WriteState = { busy: false, line: null };
  const listeners = new Set<() => void>();
  const set = (next: WriteState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function run<F>(deps: FormFilesWriteDeps<F> | null, input: I, files: readonly EvidenceFile<F>[], done: string): Promise<string | null> {
    if (!deps) {
      set({ busy: false, line: missing });
      return null;
    }
    set({ busy: true, line: null });
    const result = await writeWithFiles({ ...deps, progress: (sent, total) => set({ busy: true, line: `Subiendo ${sent} de ${total}…` }) }, valuesOf(input), files, kind);
    const outcome = writtenOutcome(result, done, kind.who);
    set({ busy: false, line: outcome.line });
    return outcome.done && result.ok ? result.answer.reportId : null;
  }
  return { get: () => state, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, run };
}

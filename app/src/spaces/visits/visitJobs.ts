import { addVisitPhoto, createdVisitIdOf, finishVisit, formRunAnswer, markVisitPoint, noticeOf, realVisitIdOf, visitDraftResultOf, visitPointRequest, watchFieldRun, type FieldJob, type FieldJobVerdict, type FieldRunWatch, type VisitFlowDeps, type VisitJobPayload } from '@lilachat/shared';
import { submitAppForm } from '../../chat/commands/commandsApi';
import { getSocket } from '../../chat/socketClient';
import { registerFieldHandler, resolveLocalVisit, resolvedVisitsNow } from '../clients/fieldQueueStore';
import { sendToDrive, type DriveFile } from '../clients/useDriveUpload';
import { keepVisitCopy } from './visitCopies';
import { askVisitDraft, openVisitForm, type VisitPlaceRef } from './visitsApi';

/**
 * The field queue's senders of a technical visit (José 26/11, `shared/visitOffline`). Each run reads
 * the visit first (our server keeps its copy 24 h and opens the forms from it), then opens its form with
 * the job's own key and sends what was captured without signal. Every step tells the watch what it got.
 */
const status = (reply: unknown): number | undefined => (reply as { status?: number }).status;

function visitDeps(ref: VisitPlaceRef, watch: FieldRunWatch, fileKey: string): VisitFlowDeps<DriveFile> {
  return {
    open: async (request) => {
      const opened = await openVisitForm(ref, request);
      watch.open({ ok: opened.ok, status: status(opened) });
      return opened;
    },
    submit: async (commandId, values) => {
      const reply = await submitAppForm(ref.jwt, { chatId: ref.chatId }, commandId, values ?? {});
      watch.submit(reply);
      return reply;
    },
    notice: async (commandId) => {
      const heard = await noticeOf(getSocket(), commandId);
      watch.notice(heard !== null);
      return heard;
    },
    send: async (upload, file, clientUploadId) => {
      const sent = await sendToDrive(upload, file, clientUploadId, () => undefined, { jwt: ref.jwt, chatId: ref.chatId });
      watch.send(sent.status);
      return sent;
    },
    // The same key on every run: Portal answers the photo it already has.
    newKey: () => fileKey,
  };
}

/** The visit as our server reads it now (it opens the forms from that copy); the phone's copy is refreshed too. */
async function readVisit(ref: VisitPlaceRef, visitId: string | null, watch: FieldRunWatch): Promise<{ ok: true } | { ok: false; message: string }> {
  const reply = await askVisitDraft(ref, visitId);
  watch.open({ ok: reply.ok, status: status(reply) });
  const draft = visitDraftResultOf(reply);
  if (!draft.ok) return draft;
  keepVisitCopy(ref.spaceId, draft.document);
  return { ok: true };
}

const fileOf = (job: FieldJob): DriveFile | null => {
  const file = job.files[0];
  return file ? { uri: file.ref, name: file.name, mime: file.mime, ...(file.stamp ? { stamp: file.stamp } : {}) } : null;
};

async function sendSection(job: FieldJob, ref: VisitPlaceRef, payload: Extract<VisitJobPayload, { kind: 'visit_section' }>, visitId: string | null, watch: FieldRunWatch): Promise<FieldJobVerdict> {
  const deps = visitDeps(ref, watch, job.key);
  const request = { kind: 'section' as const, section: payload.section, entry_id: job.key, ...(visitId ? { visit_id: visitId } : payload.place ?? {}) };
  const answer = await formRunAnswer({ open: () => deps.open(request), submit: (commandId: string) => deps.submit(commandId, payload.values), notice: deps.notice }, 'No se pudo guardar la visita.');
  if ('message' in answer) return watch.verdictOf({ ok: false, message: answer.message });
  if (!payload.creates) return { outcome: 'done' };
  const created = createdVisitIdOf(answer.response.data);
  // An answer without the id: asked again with the same key, Portal hands back the same visit.
  if (!created) return { outcome: 'retry', reached: true };
  await resolveLocalVisit(payload.visit, created);
  return { outcome: 'done' };
}

async function sendPoint(job: FieldJob, ref: VisitPlaceRef, payload: Extract<VisitJobPayload, { kind: 'visit_point' }>, visitId: string, watch: FieldRunWatch): Promise<FieldJobVerdict> {
  const file = fileOf(job);
  const deps = visitDeps(ref, watch, job.files[0]?.key ?? job.key);
  const place = { lat: payload.point.lat, lng: payload.point.lng, ...(payload.point.precisionM !== undefined ? { precisionM: payload.point.precisionM } : {}), takenAt: payload.takenAt };
  const marked = job.done.point;
  if (marked) {
    // The point landed on an earlier run: only its photo is left.
    return file ? watch.verdictOf(await addVisitPhoto(deps, visitId, file, marked, place), { point: marked }) : { outcome: 'done' };
  }
  const result = await markVisitPoint(deps, visitPointRequest(visitId, job.key, payload.point, 'apk'), file, payload.takenAt);
  if (!result.ok) return watch.verdictOf(result);
  return result.photoFailed ? watch.verdictOf({ ok: false, message: result.photoFailed }, { point: result.pointId }) : { outcome: 'done' };
}

async function sendVisitJob(job: FieldJob, jwt: string): Promise<FieldJobVerdict> {
  const payload = job.payload as unknown as VisitJobPayload;
  const ref: VisitPlaceRef = { jwt, spaceId: job.scope.spaceId, chatId: job.scope.chatId };
  const watch = watchFieldRun();
  const visitId = payload.kind === 'visit_section' && payload.creates ? null : realVisitIdOf(payload.visit, resolvedVisitsNow());
  const read = await readVisit(ref, visitId, watch);
  if (!read.ok) return watch.verdictOf(read);
  if (payload.kind === 'visit_section') return sendSection(job, ref, payload, visitId, watch);
  if (!visitId) return { outcome: 'retry', reached: false };
  if (payload.kind === 'visit_point') return sendPoint(job, ref, payload, visitId, watch);
  const deps = visitDeps(ref, watch, job.files[0]?.key ?? job.key);
  if (payload.kind === 'visit_photo') {
    const file = fileOf(job);
    return file ? watch.verdictOf(await addVisitPhoto(deps, visitId, file, undefined, payload.place)) : { outcome: 'refuse', message: 'El archivo ya no está en el teléfono.' };
  }
  const finished = await finishVisit(deps, visitId);
  return finished.ok ? { outcome: 'done' } : watch.verdictOf({ ok: false, message: finished.message });
}

for (const kind of ['visit_section', 'visit_point', 'visit_photo', 'visit_finish'] as const) registerFieldHandler(kind, sendVisitJob);


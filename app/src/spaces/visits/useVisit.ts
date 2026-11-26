import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as Crypto from 'expo-crypto';
import { createVisitScreen, isLocalVisitId, isUnreachable, localVisitId, localVisitRows, noticeOf, projectVisit, realVisitIdOf, visitDraftResultOf, visitInterviewNotice, visitJobOf, visitOfflineDraft, visitSectionForm, VISIT_NO_GPS, type EphemeralAnswer, type FieldJobFile, type VisitDocument, type VisitJobPayload, type VisitPhotoPlace, type VisitPointInput, type VisitSectionId } from '@lilachat/shared';
import { submitAppForm } from '../../chat/commands/commandsApi';
import { getSocket } from '../../chat/socketClient';
import { devicePlaceNow } from '../clients/reports/devicePlace';
import { enqueueFieldWork, fieldQueueNow, keepFieldFile, resolvedVisitsNow, subscribeFieldQueue } from '../clients/fieldQueueStore';
import { sendToDrive, type DriveFile } from '../clients/useDriveUpload';
import { keepVisitCopy, readVisitCopy, readVisitTemplate } from './visitCopies';
import { askVisitDraft, openVisitForm, type VisitPlaceRef } from './visitsApi';
import './visitJobs';

type Reply = { ok: true; data: unknown } | { ok: false; message?: string; status?: number };
const QUEUED = 'Guardado en el teléfono. Sale solo apenas haya señal.';
const FINISH_QUEUED = 'Se termina en el Portal cuando llegue todo lo guardado.';

/** The ids a visit is known by: the one asked and, once its creation landed, Portal's (or the other way round). */
function idsOf(visitId: string): string[] {
  const resolved = resolvedVisitsNow();
  const real = realVisitIdOf(visitId, resolved);
  const local = Object.entries(resolved).find(([, id]) => id === visitId)?.[0];
  return [visitId, ...(real && real !== visitId ? [real] : []), ...(local ? [local] : [])];
}

/**
 * The visit as the screen reads it (José 26/11, offline): what our server sends, kept on the phone, with
 * the queue's pending work on top; without signal, the kept copy (or the space's template for a new
 * one). A local visit whose creation already landed is read as Portal's.
 */
async function askDraftOffline(ref: VisitPlaceRef, visitId: string | null): Promise<Reply> {
  const jobs = fieldQueueNow();
  const resolved = resolvedVisitsNow();
  const real = visitId ? realVisitIdOf(visitId, resolved) : null;
  if (!visitId || real) {
    const reply = await askVisitDraft(ref, real);
    const read = visitDraftResultOf(reply);
    if (read.ok) {
      keepVisitCopy(ref.spaceId, read.document);
      const document = read.document.id ? projectVisit(read.document, jobs, idsOf(read.document.id)) : read.document;
      return { ok: true, data: { document, visits: [...localVisitRows(jobs, resolved), ...read.visits] } };
    }
    if (!isUnreachable(reply as { status?: number })) return reply;
  }
  const [saved, template] = await Promise.all([real ? readVisitCopy(ref.spaceId, real) : Promise.resolve(null), readVisitTemplate(ref.spaceId)]);
  const draft = visitOfflineDraft({ visitId, saved, template, jobs, resolved });
  return draft.ok ? { ok: true, data: { document: draft.document, visits: draft.visits } } : { ok: false, message: draft.message };
}

/** A section's form drawn on the phone from the visit's own schema: no run of Portal's app is needed to fill it. */
function localFormOf(document: VisitDocument, section: VisitSectionId): EphemeralAnswer | null {
  const form = visitSectionForm(document, section);
  return form ? { commandId: `local:${section}:${Crypto.randomUUID()}`, appName: 'Portal', command: '', action: section === 'entrevista' ? 'Entrevista' : 'Visita técnica', state: 'form', response: { responseType: 'form', form } } : null;
}

async function keptFile(file: DriveFile): Promise<FieldJobFile> {
  return keepFieldFile({ uri: file.uri, name: file.name, mime: file.mime, ...(file.stamp ? { stamp: file.stamp } : {}) });
}

/** The visit's screen on the phone (`shared/visitScreen` to read it, the field queue to write it). */
export function useVisit(ref: VisitPlaceRef, startId: string | null) {
  const screen = useMemo(() => createVisitScreen<DriveFile>({
    askDraft: (visitId) => askDraftOffline(ref, visitId),
    open: (request) => openVisitForm(ref, request),
    submit: (commandId, values) => submitAppForm(ref.jwt, { chatId: ref.chatId }, commandId, values ?? {}),
    notice: (commandId) => noticeOf(getSocket(), commandId),
    send: (upload, file, key) => sendToDrive(upload, file, key, () => undefined, { jwt: ref.jwt, chatId: ref.chatId }),
    newKey: Crypto.randomUUID,
    source: 'apk',
  }, startId), [ref, startId]);
  const state = useSyncExternalStore(screen.subscribe, screen.snapshot);
  const [notice, setNotice] = useState('');
  const [localForm, setLocalForm] = useState<{ answer: EphemeralAnswer; section: VisitSectionId } | null>(null);
  useEffect(() => {
    void screen.reload();
  }, [screen]);
  // The queue moved (a job saved or landed): the screen draws it again; a local visit just created switches to Portal's id.
  const visitIdRef = useRef(state.visitId);
  visitIdRef.current = state.visitId;
  useEffect(() => subscribeFieldQueue(() => {
    const current = visitIdRef.current;
    const real = current && isLocalVisitId(current) ? realVisitIdOf(current, resolvedVisitsNow()) : null;
    // «Guardado en el teléfono» goes once nothing of this visit waits (E2E 26/11: it stayed after the upload).
    const scopes = current ? idsOf(current).map((id) => `visit:${id}`) : [];
    if (!fieldQueueNow().some((job) => scopes.includes(job.scope.serviceId))) setNotice('');
    if (real) void screen.choose(real);
    else void screen.reload();
  }), [screen]);

  const enqueue = useCallback(async (payload: VisitJobPayload, files: FieldJobFile[] = [], key: string = Crypto.randomUUID()) => {
    await enqueueFieldWork(visitJobOf({ key, spaceId: ref.spaceId, chatId: ref.chatId, payload, files, now: Date.now() }));
    setNotice(payload.kind === 'visit_finish' ? FINISH_QUEUED : QUEUED);
  }, [ref]);

  const openSection = useCallback((section: VisitSectionId) => {
    const document = state.draft?.ok ? state.draft.document : null;
    if (!document) return;
    // A visit created without questions has no interview: say so (APK 14/11).
    const empty = section === 'entrevista' ? visitInterviewNotice(document) : null;
    if (empty) return setNotice(empty);
    const answer = localFormOf(document, section);
    if (answer) setLocalForm({ answer, section });
    else setNotice('Esta parte de la visita todavía no se puede llenar en el teléfono.');
  }, [state.draft]);

  /** «Guardar» of a section: a new visit is created here, locally, with the phone's place; it reaches Portal by the queue. */
  const submitSection = useCallback(async (values: Record<string, string>) => {
    const open = localForm;
    setLocalForm(null);
    if (!open) return;
    const visitId = state.visitId;
    if (visitId) return enqueue({ kind: 'visit_section', visit: visitId, section: open.section, values });
    const key = Crypto.randomUUID();
    const place = await devicePlaceNow();
    const where = place.lat !== undefined && place.lng !== undefined ? { place: { lat: place.lat, lng: place.lng } } : {};
    await enqueue({ kind: 'visit_section', visit: localVisitId(key), section: 'datos', values, creates: true, ...where }, [], key);
    await screen.choose(localVisitId(key));
  }, [localForm, state.visitId, enqueue, screen]);

  const markPoint = useCallback(async (point: VisitPointInput, photo: DriveFile | null) => {
    const visitId = state.visitId;
    if (!visitId) return;
    if (point.lat === undefined || point.lng === undefined) return setNotice(VISIT_NO_GPS);
    const files = photo ? [await keptFile(photo)] : [];
    await enqueue({ kind: 'visit_point', visit: visitId, point: { ...point, lat: point.lat, lng: point.lng }, takenAt: photo?.stamp?.takenAt ?? new Date().toISOString() }, files);
  }, [state.visitId, enqueue]);

  const addPhoto = useCallback(async (file: DriveFile, place: VisitPhotoPlace) => {
    if (state.visitId) await enqueue({ kind: 'visit_photo', visit: state.visitId, place }, [await keptFile(file)]);
  }, [state.visitId, enqueue]);

  const finish = useCallback(async () => {
    if (state.visitId) await enqueue({ kind: 'visit_finish', visit: state.visitId });
  }, [state.visitId, enqueue]);

  // A visit created on the phone is also known by its local id: the strip shows the work of both.
  const visitScopes = state.visitId ? idsOf(state.visitId).map((id) => `visit:${id}`) : [];
  return { ...state, visitScopes, notice: notice || state.notice, screen, openSection, localForm: localForm?.answer ?? null, submitSection, closeForm: () => setLocalForm(null), markPoint, addPhoto, finish, isLocal: Boolean(state.visitId && isLocalVisitId(state.visitId)) };
}

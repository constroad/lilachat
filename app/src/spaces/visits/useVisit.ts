import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { addVisitPhoto, createdVisitIdOf, finishVisit, markVisitPoint, noticeOf, visitDraftResultOf, visitPdf, type VisitDraftResult, type VisitFlowDeps, type VisitPointDraft, type VisitSectionId, visitPointRequest } from '@lilachat/shared';
import { submitAppForm } from '../../chat/commands/commandsApi';
import { useAnsweredSince } from '../../chat/commands/useAnsweredSince';
import { useAppAnswers } from '../../chat/commands/useAppAnswers';
import { getSocket } from '../../chat/socketClient';
import { devicePlaceNow } from '../clients/reports/devicePlace';
import { sendToDrive, type DriveFile } from '../clients/useDriveUpload';
import { askVisitDraft, openVisitForm, type VisitPlaceRef } from './visitsApi';

const NO_GPS = 'Sin GPS no se marca el punto. Enciende la ubicación y vuelve a intentarlo.';

/**
 * A technical visit on the phone (José 13/11, designs lv01–lv03): the document read through our
 * server, each section as Portal's form, and the point, photo, «Terminar» and PDF as runs sent at once.
 */
export function useVisit(ref: VisitPlaceRef, startId: string | null) {
  const [visitId, setVisitId] = useState<string | null>(startId);
  const [draft, setDraft] = useState<VisitDraftResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const answers = useAppAnswers({ jwt: ref.jwt, scope: useMemo(() => ({ chatId: ref.chatId }), [ref.chatId]) });

  const reload = useCallback(async (id: string | null = visitId) => {
    setDraft(visitDraftResultOf(await askVisitDraft(ref, id)));
  }, [ref, visitId]);
  useEffect(() => {
    setDraft(null);
    void reload(visitId);
    // Only a new id reads again; `reload` follows it.
     
  }, [visitId]);
  // Saving a new visit's details answers its id: from then on the screen is that visit.
  useEffect(() => {
    const created = answers.answers.map((answer) => createdVisitIdOf(answer.response?.data)).find(Boolean);
    if (created && created !== visitId) setVisitId(created);
  }, [answers.answers, visitId]);
  useAnsweredSince(answers.answers, () => void reload());

  const deps = useMemo<VisitFlowDeps<DriveFile>>(() => ({
    open: (request) => openVisitForm(ref, request),
    submit: (commandId) => submitAppForm(ref.jwt, { chatId: ref.chatId }, commandId, {}),
    notice: (commandId) => noticeOf(getSocket(), commandId),
    send: (upload, file, key) => sendToDrive(upload, file, key, () => undefined, { jwt: ref.jwt, chatId: ref.chatId }),
    newKey: Crypto.randomUUID,
  }), [ref]);

  /** One action at a time, with its words while it runs and what it said after. */
  const run = useCallback(async (label: string, act: () => Promise<string | null>) => {
    setBusy(label);
    setNotice('');
    const said = await act().catch(() => 'No se pudo completar. Revisa tu señal.');
    setBusy(null);
    if (said) setNotice(said);
    await reload();
  }, [reload]);

  const openSection = useCallback(async (section: VisitSectionId) => {
    const place = section === 'datos' && !visitId ? await devicePlaceNow() : null;
    const where = place?.lat !== undefined && place.lng !== undefined ? { lat: place.lat, lng: place.lng } : {};
    await answers.track({ appName: 'Portal', command: '', action: section === 'entrevista' ? 'Entrevista' : 'Visita técnica' }, () => openVisitForm(ref, { kind: 'section', section, ...(visitId ? { visit_id: visitId } : {}), ...where }));
  }, [answers, ref, visitId]);

  const markPoint = useCallback((draftPoint: Omit<VisitPointDraft, 'lat' | 'lng'> & { lat?: number; lng?: number }, photo: DriveFile | null) => run('Guardando el punto…', async () => {
    if (!visitId) return null;
    if (draftPoint.lat === undefined || draftPoint.lng === undefined) return NO_GPS;
    const marked = await markVisitPoint(deps, visitPointRequest(visitId, Crypto.randomUUID(), { ...draftPoint, lat: draftPoint.lat, lng: draftPoint.lng }, 'apk'), photo);
    if (!marked.ok) return marked.message;
    return marked.photoFailed ? `Punto ${marked.n} guardado. ${marked.photoFailed}` : `Punto ${marked.n} guardado.`;
  }), [deps, run, visitId]);

  const addPhoto = useCallback((photo: DriveFile, pointId?: string) => run('Subiendo la foto…', async () => {
    if (!visitId) return null;
    const sent = await addVisitPhoto(deps, visitId, photo, pointId);
    return sent.ok ? 'Foto agregada.' : sent.message;
  }), [deps, run, visitId]);

  const finish = useCallback(() => run('Terminando…', async () => (visitId ? (await finishVisit(deps, visitId)).message : null)), [deps, run, visitId]);

  const pdf = useCallback(async (): Promise<string | null> => {
    if (!visitId) return null;
    setBusy('Pidiendo el PDF…');
    const asked = await visitPdf(deps, visitId);
    setBusy(null);
    if (!asked.ok) setNotice(asked.message);
    return asked.ok ? asked.url : null;
  }, [deps, visitId]);

  return { visitId, setVisitId, draft, busy, notice, answers, reload, openSection, markPoint, addPhoto, finish, pdf };
}

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import * as Crypto from 'expo-crypto';
import { createVisitScreen, noticeOf, type VisitSectionId } from '@lilachat/shared';
import { submitAppForm } from '../../chat/commands/commandsApi';
import { useAnsweredSince } from '../../chat/commands/useAnsweredSince';
import { useAppAnswers } from '../../chat/commands/useAppAnswers';
import { getSocket } from '../../chat/socketClient';
import { devicePlaceNow } from '../clients/reports/devicePlace';
import { sendToDrive, type DriveFile } from '../clients/useDriveUpload';
import { askVisitDraft, openVisitForm, type VisitPlaceRef } from './visitsApi';

/** The visit's screen on the phone (`shared/visitScreen`): its state, and its sections as Portal's forms. */
export function useVisit(ref: VisitPlaceRef, startId: string | null) {
  const screen = useMemo(() => createVisitScreen<DriveFile>({
    askDraft: (visitId) => askVisitDraft(ref, visitId),
    open: (request) => openVisitForm(ref, request),
    submit: (commandId) => submitAppForm(ref.jwt, { chatId: ref.chatId }, commandId, {}),
    notice: (commandId) => noticeOf(getSocket(), commandId),
    send: (upload, file, key) => sendToDrive(upload, file, key, () => undefined, { jwt: ref.jwt, chatId: ref.chatId }),
    newKey: Crypto.randomUUID,
    source: 'apk',
  }, startId), [ref, startId]);
  const state = useSyncExternalStore(screen.subscribe, screen.snapshot);
  const answers = useAppAnswers({ jwt: ref.jwt, scope: useMemo(() => ({ chatId: ref.chatId }), [ref.chatId]) });
  useEffect(() => {
    void screen.reload();
  }, [screen]);
  useEffect(() => {
    answers.answers.forEach((answer) => screen.adopt(answer.response?.data));
  }, [answers.answers, screen]);
  useAnsweredSince(answers.answers, () => void screen.reload());
  const openSection = async (section: VisitSectionId) => {
    const place = section === 'datos' && !state.visitId ? await devicePlaceNow() : null;
    const where = place?.lat !== undefined && place.lng !== undefined ? { lat: place.lat, lng: place.lng } : {};
    await answers.track({ appName: 'Portal', command: '', action: section === 'entrevista' ? 'Entrevista' : 'Visita técnica' }, () => openVisitForm(ref, { kind: 'section', section, ...(state.visitId ? { visit_id: state.visitId } : {}), ...where }));
  };
  return { ...state, screen, answers, openSection };
}

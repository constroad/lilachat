import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createVisitScreen, noticeOf, type VisitSectionId } from '@lilachat/shared';
import { submitAppForm } from '../../chat/commands/commandsApi';
import { useAnsweredSince } from '../../chat/commands/useAnsweredSince';
import { useAppAnswers } from '../../chat/commands/useAppAnswers';
import { currentSocket } from '../../useSocket';
import { devicePlaceNow } from '../clients/reports/devicePlace';
import { sendFor, type DriveFile } from '../clients/useDriveUpload';
import { askVisitDraft, openVisitForm, type VisitPlaceRef } from './visitsApi';

/** The visit's screen on the web (`shared/visitScreen`), as the APK's: its state, and its sections as Portal's forms. */
export function useVisit(ref: VisitPlaceRef, startId: string | null) {
  const screen = useMemo(() => {
    const send = sendFor({ jwt: ref.jwt, chatId: ref.chatId });
    return createVisitScreen<DriveFile>({
      askDraft: (visitId) => askVisitDraft(ref, visitId),
      open: (request) => openVisitForm(ref, request),
      submit: (commandId) => submitAppForm(ref.jwt, { chatId: ref.chatId }, commandId, {}),
      notice: (commandId) => noticeOf(currentSocket(), commandId),
      send: (upload, file, key) => send(upload, file, key),
      newKey: () => crypto.randomUUID(),
      source: 'web',
    }, startId);
  }, [ref, startId]);
  const state = useSyncExternalStore(screen.subscribe, screen.snapshot, screen.snapshot);
  const answers = useAppAnswers({ jwt: ref.jwt, scope: useMemo(() => ({ chatId: ref.chatId }), [ref.chatId]) });
  useEffect(() => void screen.reload(), [screen]);
  useEffect(() => answers.answers.forEach((answer) => screen.adopt(answer.response?.data)), [answers.answers, screen]);
  useAnsweredSince(answers.answers, () => void screen.reload());
  /** A new visit starts where the browser is; the rest of its sections open with what Portal saved. */
  const openSection = async (section: VisitSectionId) => {
    const where = section === 'datos' && !state.visitId ? await devicePlaceNow() : null;
    const point = where?.lat !== undefined && where.lng !== undefined ? { lat: where.lat, lng: where.lng } : {};
    const action = section === 'entrevista' ? 'Entrevista' : 'Visita técnica';
    await answers.track({ appName: 'Portal', command: '', action }, () => openVisitForm(ref, { kind: 'section', section, ...(state.visitId ? { visit_id: state.visitId } : {}), ...point }));
  };
  return { ...state, screen, answers, openSection };
}

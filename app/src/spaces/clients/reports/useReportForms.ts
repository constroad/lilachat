import { useEffect, useMemo } from 'react';
import { reportFormActions, staleAnswerIds } from '@lilachat/shared';
import { useAnsweredSince } from '../../../chat/commands/useAnsweredSince';
import { useAppAnswers } from '../../../chat/commands/useAppAnswers';
import type { ServiceAskTarget } from '../useServiceAsk';
import { devicePlaceNow } from './devicePlace';
import { openReportForm } from './reportsApi';

/**
 * The report's forms run in the client's channel (the server opens each as a
 * run of the app there): a section, a photo or «Publicar» opens in the form
 * sheet, and every form answered asks the document again. The phone lends
 * its GPS and its HTTP call; the rest is `reportFormActions`.
 */
export function useReportForms(target: ServiceAskTarget, chatId: string, serviceId: string, onAnswered: () => void) {
  const answers = useAppAnswers({ jwt: target.jwt, scope: useMemo(() => ({ chatId }), [chatId]) });
  useAnsweredSince(answers.answers, onAnswered);
  const { track, dismiss } = answers;
  // A report has many sections: «Sección guardada» must not stack over them, only the newest answer stays.
  useEffect(() => {
    staleAnswerIds(answers.answers).forEach((commandId) => dismiss(commandId));
  }, [answers.answers, dismiss]);
  const actions = useMemo(() => reportFormActions({ track, placeNow: devicePlaceNow, open: (request) => openReportForm(target, serviceId, request) }), [track, target, serviceId]);
  return { answers, ...actions };
}

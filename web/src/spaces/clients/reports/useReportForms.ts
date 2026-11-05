import { useMemo } from 'react';
import { reportFormActions } from '@lilachat/shared';
import { useAnsweredSince } from '../../../chat/commands/useAnsweredSince';
import { useAppAnswers } from '../../../chat/commands/useAppAnswers';
import type { ServiceAskTarget } from '../useServiceAsk';
import { devicePlaceNow } from './devicePlace';
import { openReportForm } from './reportsApi';

/**
 * The report's forms run in the client's channel (the server opens each as a
 * run of the app there): a section, a photo or «Publicar» opens in the form
 * dialog, and every form answered asks the document again. The browser lends
 * its geolocation and its HTTP call; the rest is `reportFormActions`.
 */
export function useReportForms(target: ServiceAskTarget, chatId: string, serviceId: string, onAnswered: () => void) {
  const scope = useMemo(() => ({ chatId }), [chatId]);
  const answers = useAppAnswers({ jwt: target.jwt, scope });
  useAnsweredSince(answers.answers, onAnswered);
  const { track } = answers;
  return { answers, ...useMemo(() => reportFormActions({ track, placeNow: devicePlaceNow, open: (request) => openReportForm(target, serviceId, request) }), [track, target, serviceId]) };
}

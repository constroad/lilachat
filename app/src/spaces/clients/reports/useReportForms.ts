import { useEffect, useMemo } from 'react';
import { openPublishForm, staleAnswerIds, type FieldDocument } from '@lilachat/shared';
import { useAnsweredSince } from '../../../chat/commands/useAnsweredSince';
import { useAppAnswers } from '../../../chat/commands/useAppAnswers';
import type { ServiceAskTarget } from '../useServiceAsk';
import { openReportForm } from './reportsApi';

/**
 * «Publicar» runs in the client's channel (the server opens it as a run of the
 * app there) and needs signal: Portal validates and makes the PDF. The form
 * answered asks the document again. The sections go through the queue.
 */
export function useReportForms(target: ServiceAskTarget, chatId: string, serviceId: string, onAnswered: () => void) {
  const answers = useAppAnswers({ jwt: target.jwt, scope: useMemo(() => ({ chatId }), [chatId]) });
  useAnsweredSince(answers.answers, onAnswered);
  const { track, dismiss } = answers;
  // Publishing again must not stack its answers over the hub: only the newest stays.
  useEffect(() => {
    staleAnswerIds(answers.answers).forEach((commandId) => dismiss(commandId));
  }, [answers.answers, dismiss]);
  const openPublish = (report: FieldDocument) => openPublishForm({ track, open: (request) => openReportForm(target, serviceId, request) }, report);
  return { answers, openPublish };
}

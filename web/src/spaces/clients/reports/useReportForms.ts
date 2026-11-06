import { useEffect, useMemo } from 'react';
import { openPublishForm, staleAnswerIds, type FieldDocument } from '@lilachat/shared';
import { useAnsweredSince } from '../../../chat/commands/useAnsweredSince';
import { useAppAnswers } from '../../../chat/commands/useAppAnswers';
import type { ServiceAskTarget } from '../useServiceAsk';
import { openReportForm } from './reportsApi';

/** «Publicar», the one form that needs the network: a run of the client's app, and the document asked again once answered. */
export function useReportForms(target: ServiceAskTarget, chatId: string, serviceId: string, onAnswered: () => void) {
  const scope = useMemo(() => ({ chatId }), [chatId]);
  const answers = useAppAnswers({ jwt: target.jwt, scope });
  useAnsweredSince(answers.answers, onAnswered);
  const { track, dismiss } = answers;
  useEffect(() => {
    staleAnswerIds(answers.answers).forEach((commandId) => dismiss(commandId));
  }, [answers.answers, dismiss]);
  return { answers, openPublish: (report: FieldDocument) => openPublishForm({ track, open: (request) => openReportForm(target, serviceId, request) }, report) };
}

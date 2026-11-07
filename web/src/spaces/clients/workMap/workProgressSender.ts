import { noticeOf, sendWorkProgress, workProgressRequest } from '@lilachat/shared';
import { submitAppForm } from '../../../chat/commands/commandsApi';
import { currentSocket } from '../../../useSocket';
import { openReportForm } from '../reports/reportsApi';
import type { ServiceAskTarget } from '../useServiceAsk';
import type { ProgressSend } from './WorkMapDischarges';

/** «Confirmar avance» through the server's door (agentes 07/11): opened like the Drive upload, then sent with the note. */
const senderOf = (target: ServiceAskTarget, chatId: string, serviceId: string): ProgressSend => (entry) =>
  sendWorkProgress({
    open: () => openReportForm(target, serviceId, workProgressRequest(entry)),
    submit: (commandId, values) => submitAppForm(target.jwt, { chatId }, commandId, values),
    notice: (commandId) => noticeOf(currentSocket(), commandId),
  }, entry);

/** Only a space admin registers progress for now: anyone else gets no button at all. */
export const workProgressSender = (admin: boolean, target: ServiceAskTarget, chatId: string, serviceId: string): ProgressSend | undefined =>
  (admin ? senderOf(target, chatId, serviceId) : undefined);

import { noticeOf, sendWorkProgress, workProgressRequest } from '@lilachat/shared';
import { submitAppForm } from '../../../chat/commands/commandsApi';
import { getSocket } from '../../../chat/socketClient';
import { openReportForm } from '../reports/reportsApi';
import type { ServiceAskTarget } from '../useServiceAsk';
import type { ProgressSend } from './WorkMapDischarges';

/** «Confirmar avance» through the server's door (agentes 07/11): opened like the Drive upload, then sent with the note. */
const senderOf = (target: ServiceAskTarget, chatId: string, serviceId: string): ProgressSend => (entry) =>
  sendWorkProgress({
    open: () => openReportForm(target, serviceId, workProgressRequest(entry)),
    submit: (commandId, values) => submitAppForm(target.jwt, { chatId }, commandId, values),
    notice: (commandId) => noticeOf(getSocket(), commandId),
  }, entry);

/** Everyone in the client's channel registers progress (José 07/11: «todos pueden crear y actualizar»). */
export const workProgressSender = (target: ServiceAskTarget, chatId: string, serviceId: string): ProgressSend => senderOf(target, chatId, serviceId);

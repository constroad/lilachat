import { noticeOf, type CommandNotice, type FieldJob, type FieldRunWatch, type FormSubmitReply, type ReportFormRequest } from '@lilachat/shared';
import { submitAppForm } from '../../chat/commands/commandsApi';
import { getSocket } from '../../chat/socketClient';
import { openReportForm } from './reports/reportsApi';

/**
 * A service's form door (open → submit → its answer on the socket) for a field job: the same calls
 * the screens make, each one telling the run's watch what it got (`shared/fieldQueue` › `watchFieldRun`).
 */
export function watchedDoor(job: FieldJob, jwt: string, watch: FieldRunWatch, request: ReportFormRequest) {
  const { serviceId, chatId } = job.scope;
  const target = { jwt, spaceId: job.scope.spaceId, clientId: job.scope.clientId };
  return {
    open: async () => {
      const opened = await openReportForm(target, serviceId, request);
      watch.open({ ok: opened.ok, status: (opened as { status?: number }).status });
      return opened;
    },
    submit: async (commandId: string, values: Record<string, string>): Promise<FormSubmitReply> => {
      const reply = await submitAppForm(jwt, { chatId }, commandId, values);
      watch.submit(reply);
      return reply;
    },
    notice: async (commandId: string): Promise<CommandNotice | null> => {
      const heard = await noticeOf(getSocket(), commandId);
      watch.notice(heard !== null);
      return heard;
    },
  };
}

import { reportDraftPath, reportDraftRequest, reportFormsPath, type CommandOutcome, type ReportDraftBody, type ReportFormRequest } from '@lilachat/shared';
import { api } from '../../../api';
import type { ServiceAskTarget } from '../useServiceAsk';

/** The document of a report (or the empty one of that type), asked to Portal through the server. */
export const askReportDraft = (target: ServiceAskTarget, serviceId: string, type: string, reportId: string | null) =>
  api<ReportDraftBody>(reportDraftPath(target.spaceId, target.clientId, serviceId), { jwt: target.jwt, body: reportDraftRequest(type, reportId) });

/** One of the report's forms (a section, a photo, «Publicar») opened as a run of the client's app. */
export const openReportForm = (target: ServiceAskTarget, serviceId: string, request: ReportFormRequest) =>
  api<CommandOutcome>(reportFormsPath(target.spaceId, target.clientId, serviceId), { jwt: target.jwt, body: request });

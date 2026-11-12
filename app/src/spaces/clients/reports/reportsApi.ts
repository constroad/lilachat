import { reportDraftPath, reportDraftRequest, reportFormsPath, sharedInFlight, type CommandOutcome, type ReportDraftBody, type ReportFormRequest } from '@lilachat/shared';
import { BASE_URL } from '../../../api/client';
import { jsonCall } from '../../../api/jsonCall';
import type { ServiceAskTarget } from '../useServiceAsk';

/**
 * The document of a report (or the empty one of that type), asked to Portal through the server.
 * Reads that overlap share one request: re-renders and a second screen do not ask again (agentes 12/11).
 */
export const askReportDraft = sharedInFlight(
  (target: ServiceAskTarget, serviceId: string, type: string, reportId: string | null) => [target.jwt, target.spaceId, target.clientId, serviceId, type, reportId ?? ''].join('|'),
  (target: ServiceAskTarget, serviceId: string, type: string, reportId: string | null) =>
    jsonCall<ReportDraftBody>(`${BASE_URL}/api${reportDraftPath(target.spaceId, target.clientId, serviceId)}`, target.jwt, { method: 'POST', body: JSON.stringify(reportDraftRequest(type, reportId)) })
);

/** One of the report's forms (a section, a photo, «Publicar») opened as a run of the client's app. */
export const openReportForm = (target: ServiceAskTarget, serviceId: string, request: ReportFormRequest) =>
  jsonCall<CommandOutcome>(`${BASE_URL}/api${reportFormsPath(target.spaceId, target.clientId, serviceId)}`, target.jwt, { method: 'POST', body: JSON.stringify(request) });

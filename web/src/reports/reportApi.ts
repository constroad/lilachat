import type { ReportReason, ReportSubject } from '@lilachat/shared';
import { api } from '../api';

export type ReportPayload = ReportSubject & { reason: ReportReason; note: string; alsoBlock: boolean };
export type ReportReply = { reportId: string; duplicate: boolean; blocked: boolean };

/** `POST /api/reports` (José 19/11): a failure comes back with the server's reason, never throws. */
export const sendReport = (jwt: string, payload: ReportPayload) => api<ReportReply>('/reports', { jwt, body: payload });

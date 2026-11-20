import type { ReportReason, ReportSubject } from '@lilachat/shared';
import { BASE_URL } from '../api/client';
import { jsonCall } from '../api/jsonCall';

export type ReportPayload = ReportSubject & { reason: ReportReason; note: string; alsoBlock: boolean };
export type ReportReply = { reportId: string; duplicate: boolean; blocked: boolean };

/** `POST /api/reports` (Google Play, José 19/11): a refusal comes back with the server's reason, never throws. */
export const sendReport = (jwt: string, payload: ReportPayload) => jsonCall<ReportReply>(`${BASE_URL}/api/reports`, jwt, { method: 'POST', body: JSON.stringify(payload) });

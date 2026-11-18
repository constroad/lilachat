import type { BotCard, DaliKnowledge, ProspectDocument, ProspectView } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';

/**
 * The doors of a Dali space for its members (BOTS-API «Fase 2: contrato»), the same the web uses: the prospects, what
 * a seller decides about each one, and what Dali knows. Money (`quote.amount`, prices) only comes to a space admin.
 */
export type ProspectList = { prospects: ProspectView[]; admin: boolean; enabled: boolean; me: string };
export type ProspectAnswer = { prospect: ProspectView };
export type DaliReviewCard = { chatId: string; seq: number; at: string; card?: BotCard };

const spaceUrl = (spaceId: string) => `${BASE_URL}/api/workspaces/${spaceId}`;
const prospectUrl = (spaceId: string, prospectId: string) => `${spaceUrl(spaceId)}/prospects/${encodeURIComponent(prospectId)}`;
const send = (method: 'POST' | 'PATCH', body: Record<string, unknown>) => ({ method, body: JSON.stringify(body) });

export const fetchProspects = (jwt: string, spaceId: string, since: string) => jsonCall<ProspectList>(`${spaceUrl(spaceId)}/prospects?since=${encodeURIComponent(since)}`, jwt);
export const fetchProspectOfChat = (jwt: string, spaceId: string, chatId: string) => jsonCall<ProspectAnswer>(`${spaceUrl(spaceId)}/prospects/by-chat/${encodeURIComponent(chatId)}`, jwt);
/** What the client sent in their channel (a KML, a photo, a PDF with metrados), newest first. */
export const fetchProspectDocuments = (jwt: string, spaceId: string, prospectId: string) => jsonCall<{ documents: ProspectDocument[] }>(`${prospectUrl(spaceId, prospectId)}/documents`, jwt);
export const changeProspect = (jwt: string, spaceId: string, prospectId: string, body: Record<string, unknown>) => jsonCall<ProspectAnswer>(prospectUrl(spaceId, prospectId), jwt, send('PATCH', body));
export const approveFollowUp = (jwt: string, spaceId: string, prospectId: string, version: number, text: string) => jsonCall<ProspectAnswer>(`${prospectUrl(spaceId, prospectId)}/follow-up`, jwt, send('POST', { version, text }));
/** «Confirmar» (no value) or «Corregir» (the right value) of a field Dali read from a document (fase 3). */
export const confirmProspectField = (jwt: string, spaceId: string, prospectId: string, body: { version: number; key: string; value?: string }) => jsonCall<ProspectAnswer>(`${prospectUrl(spaceId, prospectId)}/fields/confirm`, jwt, send('POST', body));
export const handBackToDali = (jwt: string, spaceId: string, prospectId: string, version: number) => jsonCall<ProspectAnswer>(`${prospectUrl(spaceId, prospectId)}/handback`, jwt, send('POST', { version }));
export const fetchKnowledge = (jwt: string, spaceId: string) => jsonCall<{ knowledge: DaliKnowledge }>(`${spaceUrl(spaceId)}/dali/knowledge`, jwt);
export const teachDali = (jwt: string, spaceId: string, body: { question: string; answer: string; idempotency_key: string }) => jsonCall<{ faq: { id: string } }>(`${spaceUrl(spaceId)}/dali/faqs`, jwt, send('POST', body));
export const fetchReview = (jwt: string, spaceId: string) => jsonCall<{ review: DaliReviewCard | null }>(`${spaceUrl(spaceId)}/dali/review`, jwt);

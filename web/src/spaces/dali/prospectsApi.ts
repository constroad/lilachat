import type { BotCard, DaliKnowledge, ProspectView } from '@lilachat/shared';
import { api } from '../../api';

/**
 * The doors of a Dali space for its members (BOTS-API «Fase 2: contrato»): the prospects, what a seller decides about
 * each one, and what Dali knows. Money (`quote.amount`, prices) only comes to a space admin: the server strips it.
 */
export type ProspectList = { prospects: ProspectView[]; admin: boolean; enabled: boolean; me: string };
export type ProspectAnswer = { prospect: ProspectView };
export type DaliReviewCard = { chatId: string; seq: number; at: string; card?: BotCard };

const spacePath = (spaceId: string) => `/workspaces/${spaceId}`;
const prospectPath = (spaceId: string, prospectId: string) => `${spacePath(spaceId)}/prospects/${encodeURIComponent(prospectId)}`;

export const fetchProspects = (jwt: string, spaceId: string, since: string, signal?: AbortSignal) =>
  api<ProspectList>(`${spacePath(spaceId)}/prospects?since=${encodeURIComponent(since)}`, { jwt, signal });

/** The prospect of a channel: the strip over its conversation and its ficha, also for one older than the list. */
export const fetchProspectOfChat = (jwt: string, spaceId: string, chatId: string, signal?: AbortSignal) =>
  api<ProspectAnswer>(`${spacePath(spaceId)}/prospects/by-chat/${encodeURIComponent(chatId)}`, { jwt, signal });

/** Take it, plan the next action, mark the result: always with the `version` the seller saw (409 if someone was first). */
export const changeProspect = (jwt: string, spaceId: string, prospectId: string, body: Record<string, unknown>) =>
  api<ProspectAnswer>(prospectPath(spaceId, prospectId), { jwt, method: 'PATCH', body });

export const approveFollowUp = (jwt: string, spaceId: string, prospectId: string, version: number, text: string) =>
  api<ProspectAnswer>(`${prospectPath(spaceId, prospectId)}/follow-up`, { jwt, body: { version, text } });

export const handBackToDali = (jwt: string, spaceId: string, prospectId: string, version: number) =>
  api<ProspectAnswer>(`${prospectPath(spaceId, prospectId)}/handback`, { jwt, body: { version } });

export const fetchKnowledge = (jwt: string, spaceId: string) => api<{ knowledge: DaliKnowledge }>(`${spacePath(spaceId)}/dali/knowledge`, { jwt });

export const teachDali = (jwt: string, spaceId: string, body: { question: string; answer: string; idempotency_key: string }) =>
  api<{ faq: { id: string } }>(`${spacePath(spaceId)}/dali/faqs`, { jwt, body });

export const fetchReview = (jwt: string, spaceId: string) => api<{ review: DaliReviewCard | null }>(`${spacePath(spaceId)}/dali/review`, { jwt });

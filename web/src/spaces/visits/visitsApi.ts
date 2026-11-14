import { visitDraftPath, visitFormsPath, type CommandOutcome, type VisitFormRequest } from '@lilachat/shared';
import { api } from '../../api';

/** Where a visit is made: the space and the chat (its `visitas` channel or the 1:1 with the app). */
export type VisitPlaceRef = { jwt: string; spaceId: string; chatId: string };

/** Whether this chat is a visits door: our server answers alone, agentes is not asked. */
export const askVisitDoor = (ref: VisitPlaceRef) => api<{ open: boolean }>(`/workspaces/${ref.spaceId}/visits/door?chat_id=${encodeURIComponent(ref.chatId)}`, { jwt: ref.jwt });

/** The visit (or a new one with the open ones), read by agentes as the person. */
export const askVisitDraft = (ref: VisitPlaceRef, visitId: string | null) => api<unknown>(visitDraftPath(ref.spaceId), { jwt: ref.jwt, body: { chat_id: ref.chatId, ...(visitId ? { visit_id: visitId } : {}) } });

/** A section, a point, a photo ticket, «Terminar» or the PDF, opened as a run of Portal's app. */
export const openVisitForm = (ref: VisitPlaceRef, request: VisitFormRequest) => api<CommandOutcome>(visitFormsPath(ref.spaceId), { jwt: ref.jwt, body: { chat_id: ref.chatId, ...request } });

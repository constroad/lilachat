import { visitDraftPath, visitFormsPath, type CommandOutcome, type VisitFormRequest } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';

/** Where a visit is made: the space and the chat (its `visitas` channel or the 1:1 with the app). */
export type VisitPlaceRef = { jwt: string; spaceId: string; chatId: string };

/** Whether this chat is a visits door: our server answers alone, agentes is not asked. */
export const askVisitDoor = (ref: VisitPlaceRef) =>
  jsonCall<{ open: boolean }>(`${BASE_URL}/api/workspaces/${ref.spaceId}/visits/door?chat_id=${encodeURIComponent(ref.chatId)}`, ref.jwt);

/** The visit (or a new one with the open ones), read by agentes as the person. */
export const askVisitDraft = (ref: VisitPlaceRef, visitId: string | null) =>
  jsonCall<unknown>(`${BASE_URL}/api${visitDraftPath(ref.spaceId)}`, ref.jwt, { method: 'POST', body: JSON.stringify({ chat_id: ref.chatId, ...(visitId ? { visit_id: visitId } : {}) }) });

/** A section, a point, a photo ticket, «Terminar» or the PDF, opened as a run of Portal's app. */
export const openVisitForm = (ref: VisitPlaceRef, request: VisitFormRequest) =>
  jsonCall<CommandOutcome>(`${BASE_URL}/api${visitFormsPath(ref.spaceId)}`, ref.jwt, { method: 'POST', body: JSON.stringify({ chat_id: ref.chatId, ...request }) });

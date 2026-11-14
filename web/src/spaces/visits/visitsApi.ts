import { visitDraftPath, visitDraftResultOf, visitFormsPath, type CommandOutcome, type VisitFormRequest } from '@lilachat/shared';
import { api, type ApiResult } from '../../api';

/** Where a visit is made: the space and the chat; without a chat, the space's ⚡ (agentes 14/11: `place: 'space'`). */
export type VisitPlaceRef = { jwt: string; spaceId: string; chatId?: string };
/** A visit opened from its card or a chat: there is always the chat. */
export type VisitChatRef = VisitPlaceRef & { chatId: string };
const chatOf = (ref: VisitPlaceRef) => (ref.chatId ? { chat_id: ref.chatId } : {});

/** Whether this chat is a visits door: our server answers alone, agentes is not asked. */
export const askVisitDoor = (ref: VisitPlaceRef) => api<{ open: boolean }>(`/workspaces/${ref.spaceId}/visits/door?chat_id=${encodeURIComponent(ref.chatId ?? '')}`, { jwt: ref.jwt });

/** The visit (or a new one with the open ones), read by agentes as the person. */
export const askVisitDraft = (ref: VisitPlaceRef, visitId: string | null) => api<unknown>(visitDraftPath(ref.spaceId), { jwt: ref.jwt, body: { ...chatOf(ref), ...(visitId ? { visit_id: visitId } : {}) } });

/** A section, a point, a photo ticket, «Terminar» or the PDF, opened as a run of Portal's app. */
export const openVisitForm = (ref: VisitPlaceRef, request: VisitFormRequest) => api<CommandOutcome>(visitFormsPath(ref.spaceId), { jwt: ref.jwt, body: { ...chatOf(ref), ...request } });

/**
 * «Visita técnica» from the ⚡ or the «+» (José 14/11): a new visit is read first (Portal keeps its draft),
 * then «Datos» opens where the browser is. Saving it makes Portal publish its card lv01 in «Informes».
 */
export async function startVisit(ref: VisitPlaceRef, place: { lat?: number; lng?: number } | null): Promise<ApiResult<CommandOutcome>> {
  const draft = visitDraftResultOf(await askVisitDraft(ref, null));
  if (!draft.ok) return { ok: false, status: 0, message: draft.message };
  const where = place?.lat !== undefined && place.lng !== undefined ? { lat: place.lat, lng: place.lng } : {};
  return openVisitForm(ref, { kind: 'section', section: 'datos', ...where });
}

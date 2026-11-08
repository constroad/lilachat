import { type MapEditSend, serviceLinkRequest, serviceMapUrl, type ChannelLinks, noticeOf, saveStreetWithStage, sendWorkProgress, sendWorkScope, sendWorkStreet, type FormValues, type ReportFormRequest, sendWorkStreetDelete, workProgressRequest, workStreetDeleteRequest, workStreetRequest, type StreetDraft, type WorkProgressResult, type PlaceAsk, type PlaceResult, PLACE_SEARCH_FAILED } from '@lilachat/shared';
import { submitAppForm } from '../../../chat/commands/commandsApi';
import { api } from '../../../api';
import { currentSocket } from '../../../useSocket';
import { openReportForm } from '../reports/reportsApi';
import type { ServiceAskTarget } from '../useServiceAsk';
import type { ProgressSend } from './WorkMapDischarges';
import type { StreetDeleteSend } from './StreetDelete';

/** «Confirmar avance» through the server's door (agentes 07/11): opened like the Drive upload, then sent with the note. */
const senderOf = (target: ServiceAskTarget, chatId: string, serviceId: string): ProgressSend => (entry) =>
  sendWorkProgress({
    open: () => openReportForm(target, serviceId, workProgressRequest(entry)),
    submit: (commandId, values) => submitAppForm(target.jwt, { chatId }, commandId, values),
    notice: (commandId) => noticeOf(currentSocket(), commandId),
  }, entry);

/** Everyone in the client's channel registers progress (José 07/11: «todos pueden crear y actualizar»). */
export const workProgressSender = (target: ServiceAskTarget, chatId: string, serviceId: string): ProgressSend => senderOf(target, chatId, serviceId);

export type StreetSend = (draft: StreetDraft, entryId: string) => Promise<WorkProgressResult>;

/** «Guardar calle» (design o-02) through the same door: Portal's `guardar_calle_de_obra` with the line as context. */
export const workStreetSender = (target: ServiceAskTarget, chatId: string, serviceId: string): StreetSend => (draft, entryId) => {
  const door = (request: ReportFormRequest) => ({
    open: () => openReportForm(target, serviceId, request),
    submit: (commandId: string, values: FormValues) => submitAppForm(target.jwt, { chatId }, commandId, values),
    notice: (commandId: string) => noticeOf(currentSocket(), commandId),
  });
  return saveStreetWithStage(() => sendWorkStreet(door(workStreetRequest(draft, entryId))), (request) => sendWorkScope(door(request)), draft.stageId, entryId);
};

/** «Borrar calle» through the same door: Portal's logical `borrar_calle_de_obra` (José 07/11). */
export const workStreetDeleteSender = (target: ServiceAskTarget, chatId: string, serviceId: string): StreetDeleteSend => (streetId) =>
  sendWorkStreetDelete({
    open: () => openReportForm(target, serviceId, workStreetDeleteRequest(streetId)),
    submit: (commandId, values) => submitAppForm(target.jwt, { chatId }, commandId, values),
    notice: (commandId) => noticeOf(currentSocket(), commandId),
  });

/** Any other edit of the map (stretches, stages, works; step 3): the request opens at the door, `run` reads the answer. */
export const mapEditSender = (target: ServiceAskTarget, chatId: string, serviceId: string): MapEditSend => (request, run) =>
  run({
    open: () => openReportForm(target, serviceId, request),
    submit: (commandId, values) => submitAppForm(target.jwt, { chatId }, commandId, values),
    notice: (commandId) => noticeOf(currentSocket(), commandId),
  });

/** The map's link through the server's door, not the channel's shortcut: every member sees the map (José 07/11). */
export const doorMapLinks = (links: ChannelLinks, target: ServiceAskTarget, chatId: string, serviceId: string): ChannelLinks => ({
  ...links,
  map: () => serviceMapUrl({
    open: () => openReportForm(target, serviceId, serviceLinkRequest()),
    submit: (commandId, values) => submitAppForm(target.jwt, { chatId }, commandId, values),
    notice: (commandId) => noticeOf(currentSocket(), commandId),
  }),
});

/** «Busca un lugar o pega el enlace» (José 08/11): the server follows short links and asks OpenStreetMap. */
export const placeAsker = (jwt: string): PlaceAsk => async (text, near) => {
  const answer = await api<{ results: PlaceResult[] }>('/places', { jwt, body: { q: text, ...(near ? { near } : {}) } });
  return answer.ok ? { ok: true, results: answer.data.results } : { ok: false, message: answer.message || PLACE_SEARCH_FAILED };
};

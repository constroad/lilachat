import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import { checklistTextInChat } from '@lilachat/shared';
import { ChecklistModel } from './checklistModel.js';
import { publicarEnElChat } from './publicarEnElChat.js';
import { fijarMensaje } from './mensajesFijados.js';
import { avisarCambioDeChat } from './reparto.js';

export const newItemId = () => randomBytes(6).toString('hex');
/** A checklist's pin lasts 30 days: long enough for a job, and it goes by itself. */
const PIN_DURATION = '30d';

/** Pins the card; a refusal (a member who is not an admin of the group) leaves it unpinned without failing. */
export async function pinCard(chatId: string, userId: Types.ObjectId, seq: number): Promise<void> {
  const pinned = await fijarMensaje({ chatId, quien: userId, seq, duracion: PIN_DURATION });
  if (pinned.ok) for (const member of pinned.miembros) avisarCambioDeChat(member, chatId);
}

/**
 * A checklist and its card in the chat, already validated: from the app
 * (`POST /api/agenda/checklists`) or from an app's webhook (pending 33), whose
 * tasks may come with their person and date.
 */
export async function createChecklistInChat(params: {
  chatId: string;
  createdBy: Types.ObjectId;
  title: string;
  items: { text: string; assignee?: Types.ObjectId | null; dueAt?: Date | null }[];
  othersCanMark: boolean;
  othersCanAdd: boolean;
  hiloDe?: number;
  pin: boolean;
}): Promise<{ id: string; cardSeq?: number }> {
  const checklist = await ChecklistModel.create({
    chatId: params.chatId,
    createdBy: params.createdBy,
    title: params.title,
    items: params.items.map((item) => ({ id: newItemId(), text: item.text, addedBy: params.createdBy, doneBy: null, doneAt: null, assignee: item.assignee ?? null, dueAt: item.dueAt ?? null })),
    othersCanMark: params.othersCanMark,
    othersCanAdd: params.othersCanAdd,
  });
  try {
    const cardSeq = await publicarEnElChat({ chatId: params.chatId, autor: params.createdBy, ref: { tipo: 'checklist', id: String(checklist._id) }, texto: checklistTextInChat(params.title), hiloDe: params.hiloDe });
    await ChecklistModel.updateOne({ _id: checklist._id }, { $set: { cardSeq } });
    // Pinned by default so it is never lost in the messages (backlog 30). In a group only admins pin: otherwise it just stays unpinned.
    if (params.pin && params.hiloDe === undefined) await pinCard(params.chatId, params.createdBy, cardSeq);
    return { id: String(checklist._id), cardSeq };
  } catch (error) {
    // The checklist exists; a card that fails to go out is logged, it does not undo it.
    console.error('[checklist] no se pudo publicar en el chat:', error instanceof Error ? error.message : error);
    return { id: String(checklist._id) };
  }
}

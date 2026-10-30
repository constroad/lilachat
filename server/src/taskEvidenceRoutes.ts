import { Router, type Response } from 'express';
import { Types } from 'mongoose';
import { linkEvidence, type TaskEvidence } from '@lilachat/shared';
import { ChatModel, MessageModel } from './chatModels.js';
import { ChecklistModel, type Checklist, type TaskEvidenceEntry } from './checklistModel.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { avisarCambioDeTarjeta } from './avisoDeTarjeta.js';
import { ownTasksOnly, stageScopeFor } from './stageAccess.js';

const EVIDENCE_KINDS = new Set<TaskEvidenceEntry['kind']>(['image', 'video', 'file']);
const GONE = 'Esa tarea ya no está.';

/** The checklist and its task if I am in its chat; otherwise 404 (nothing confirmed to exist) and null. */
async function taskOfMember(params: { id: string; itemId: string; userId: Types.ObjectId; res: Response }): Promise<Checklist | null> {
  const found = Types.ObjectId.isValid(params.id) ? await ChecklistModel.findById(params.id).lean() : null;
  const member = found && (await ChatModel.exists({ _id: found.chatId, 'members.userId': params.userId }));
  // José 30/10 night: a restricted member only reaches the tasks of the stages they see (or their own).
  const scope = found && member ? await stageScopeFor(found, params.userId) : 'none';
  const checklist = found && scope === 'own' ? ownTasksOnly(found, params.userId) : found;
  if (!checklist || scope === 'none' || !checklist.items.some((item) => item.id === params.itemId)) {
    params.res.status(404).json({ message: GONE });
    return null;
  }
  return checklist;
}

/** The file of a live message of that chat, as evidence; `null` when there is no such message, `'no_file'` when it has none. */
async function evidenceFromMessage(chatId: Types.ObjectId, seq: number, by: Types.ObjectId): Promise<TaskEvidenceEntry | 'no_file' | null> {
  const message = await MessageModel.findOne({ chatId, seq, deletedAt: { $exists: false } }).select('kind media').lean();
  if (!message) return null;
  const kind = message.kind as TaskEvidenceEntry['kind'];
  if (!EVIDENCE_KINDS.has(kind) || !message.media?.url) return 'no_file';
  return { seq, kind, url: message.media.url, ...(message.media.thumbUrl ? { thumbUrl: message.media.thumbUrl } : {}), name: message.media.fileName ?? 'archivo', sizeBytes: message.media.sizeBytes ?? 0, by, at: new Date() };
}

const asShared = (file: TaskEvidenceEntry): TaskEvidence => ({ seq: file.seq, kind: file.kind, url: file.url, name: file.name, sizeBytes: file.sizeBytes, by: String(file.by), at: file.at.toISOString() });

/**
 * The evidence of a task of a job's channel (pending 21, design e2-18). The
 * file goes up as a message of the channel, as always; this links that
 * message to the task by its seq, so the chat keeps its history and the task
 * only points at it. Unlinking never deletes the message.
 */
export function buildTaskEvidenceRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.post('/checklists/:id/items/:itemId/evidence', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const seq = req.body?.seq;
    if (!Number.isInteger(seq) || seq < 1) return res.status(400).json({ message: 'Falta el archivo.' });
    const checklist = await taskOfMember({ id: String(req.params.id), itemId: String(req.params.itemId), userId, res });
    if (!checklist) return;
    const file = await evidenceFromMessage(checklist.chatId, seq, userId);
    if (!file) return res.status(404).json({ message: 'Ese archivo ya no está en el chat.' });
    if (file === 'no_file') return res.status(400).json({ message: 'Ese mensaje no tiene un archivo.' });
    const task = checklist.items.find((item) => item.id === req.params.itemId)!;
    const linked = linkEvidence((task.evidence ?? []).map(asShared), asShared(file));
    if (!linked.ok) return res.status(400).json({ message: linked.message });
    if (linked.added) {
      await ChecklistModel.updateOne({ _id: checklist._id, 'items.id': task.id, 'items.evidence.seq': { $ne: seq } }, { $push: { 'items.$.evidence': file } });
      void avisarCambioDeTarjeta({ chatId: checklist.chatId, tipo: 'checklist', id: checklist._id });
    }
    res.json({ ok: true, added: linked.added });
  }));

  /** Who linked it, or who made the checklist, unlinks it. */
  router.delete('/checklists/:id/items/:itemId/evidence/:seq', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const seq = Number(req.params.seq);
    const checklist = await taskOfMember({ id: String(req.params.id), itemId: String(req.params.itemId), userId, res });
    if (!checklist) return;
    const file = checklist.items.find((item) => item.id === req.params.itemId)!.evidence?.find((one) => one.seq === seq);
    if (!file) return res.json({ ok: true });
    if (!file.by.equals(userId) && !checklist.createdBy.equals(userId)) return res.status(403).json({ message: 'Solo quien lo subió lo quita.' });
    await ChecklistModel.updateOne({ _id: checklist._id, 'items.id': req.params.itemId }, { $pull: { 'items.$.evidence': { seq } } });
    void avisarCambioDeTarjeta({ chatId: checklist.chatId, tipo: 'checklist', id: checklist._id });
    res.json({ ok: true });
  }));

  return router;
}

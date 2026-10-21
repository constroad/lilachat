import { randomBytes } from 'node:crypto';
import { Router, type Response } from 'express';
import { Types } from 'mongoose';
import { checklistPermissions, checklistTextInChat, toggleChecklistItem, validateChecklist, validateChecklistItem, type AgendaChecklist } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { ChecklistModel, type Checklist } from './checklistModel.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { publicarEnElChat } from './publicarEnElChat.js';
import { avisarCambioDeTarjeta } from './avisoDeTarjeta.js';

/** A task's own id: 6 random bytes, enough inside one checklist of up to 30. */
const newItemId = () => randomBytes(6).toString('hex');

/** The checklist as the card reads it (ids as strings). */
function view(checklist: Checklist): AgendaChecklist {
  return {
    _id: String(checklist._id),
    chatId: String(checklist.chatId),
    createdBy: String(checklist.createdBy),
    title: checklist.title,
    items: checklist.items.map((item) => ({ id: item.id, text: item.text, doneBy: item.doneBy ? String(item.doneBy) : null, doneAt: item.doneAt ? item.doneAt.toISOString() : null })),
    othersCanMark: checklist.othersCanMark,
    othersCanAdd: checklist.othersCanAdd,
    createdAt: checklist.createdAt.toISOString(),
  };
}

/** The checklist if it exists and I am in its chat; otherwise 404 (it is not confirmed to exist) and null. */
async function checklistOfMember(id: unknown, userId: Types.ObjectId, res: Response): Promise<Checklist | null> {
  const checklist = typeof id === 'string' && Types.ObjectId.isValid(id) ? await ChecklistModel.findById(id).lean() : null;
  const member = checklist && (await ChatModel.exists({ _id: checklist.chatId, 'members.userId': userId }));
  if (!checklist || !member) {
    res.status(404).json({ message: 'Ese checklist ya no está.' });
    return null;
  }
  return checklist;
}

/** After answering: the chat hears about it and its cards reload. */
const announce = (checklist: Checklist) => void avisarCambioDeTarjeta({ chatId: checklist.chatId, tipo: 'checklist', id: checklist._id });

/**
 * Checklists in the chat, like Telegram's (backlog 8, José 21/10). Any member
 * of a non-secret chat creates one; its card goes to the chat; whoever made it
 * decides whether the others tick and add; only they delete it. Every change
 * reaches the chat live.
 */
export function buildChecklistRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.post('/checklists', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const chatId = typeof req.body?.chatId === 'string' && Types.ObjectId.isValid(req.body.chatId) ? req.body.chatId : null;
    const chat = chatId ? await ChatModel.findOne({ _id: chatId, 'members.userId': userId }).select('encrypted').lean() : null;
    if (!chat) return res.status(403).json({ message: 'No tienes acceso a esa conversación.' });
    if (chat.encrypted) return res.status(403).json({ message: 'En un chat secreto todavía no se pueden crear checklists: no viajarían cifrados.' });
    const valid = validateChecklist({ title: String(req.body?.title ?? ''), items: Array.isArray(req.body?.items) ? req.body.items.map(String) : [] });
    if (!valid.ok) return res.status(400).json({ message: valid.message });
    const checklist = await ChecklistModel.create({
      chatId,
      createdBy: userId,
      title: valid.title,
      items: valid.items.map((text) => ({ id: newItemId(), text, addedBy: userId, doneBy: null, doneAt: null })),
      othersCanMark: req.body?.othersCanMark !== false,
      othersCanAdd: req.body?.othersCanAdd !== false,
    });
    try {
      await publicarEnElChat({ chatId: String(chatId), autor: userId, ref: { tipo: 'checklist', id: String(checklist._id) }, texto: checklistTextInChat(valid.title) });
    } catch (error) {
      // The checklist exists; a card that fails to go out is logged, it does not undo it.
      console.error('[checklist] no se pudo publicar en el chat:', error instanceof Error ? error.message : error);
    }
    res.status(201).json({ id: String(checklist._id) });
  }));

  router.get('/checklists/:id', asyncRoute(async (req, res) => {
    const checklist = await checklistOfMember(req.params.id, req.session!.userId, res);
    if (checklist) res.json({ checklist: view(checklist) });
  }));

  router.post('/checklists/:id/items/:itemId/toggle', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const checklist = await checklistOfMember(req.params.id, userId, res);
    if (!checklist) return;
    if (!checklistPermissions({ me: String(userId), createdBy: String(checklist.createdBy), othersCanMark: checklist.othersCanMark, othersCanAdd: checklist.othersCanAdd }).canMark) {
      return res.status(403).json({ message: 'Solo quien lo creó marca las tareas.' });
    }
    const toggled = toggleChecklistItem(view(checklist).items, String(req.params.itemId), String(userId), new Date());
    if (!toggled.ok) return res.status(404).json({ message: toggled.message });
    const item = toggled.items.find((one) => one.id === req.params.itemId)!;
    const before = checklist.items.find((one) => one.id === item.id)!;
    // Only that task, guarded by the state it had: two people ticking at once do not undo each other.
    const updated = await ChecklistModel.findOneAndUpdate(
      { _id: checklist._id, items: { $elemMatch: { id: item.id, doneBy: before.doneBy ?? null } } },
      { $set: { 'items.$.doneBy': item.doneBy ? userId : null, 'items.$.doneAt': item.doneAt ? new Date(item.doneAt) : null } },
      { returnDocument: 'after' }
    ).lean();
    if (!updated) return res.status(409).json({ message: 'Alguien la marcó al mismo tiempo. Mira cómo quedó.' });
    res.json({ checklist: view(updated) });
    announce(updated);
  }));

  router.post('/checklists/:id/items', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const checklist = await checklistOfMember(req.params.id, userId, res);
    if (!checklist) return;
    if (!checklistPermissions({ me: String(userId), createdBy: String(checklist.createdBy), othersCanMark: checklist.othersCanMark, othersCanAdd: checklist.othersCanAdd }).canAdd) {
      return res.status(403).json({ message: 'Solo quien lo creó agrega tareas.' });
    }
    const valid = validateChecklistItem(String(req.body?.text ?? ''), checklist.items);
    if (!valid.ok) return res.status(400).json({ message: valid.message });
    const updated = await ChecklistModel.findByIdAndUpdate(checklist._id, { $push: { items: { id: newItemId(), text: valid.text, addedBy: userId, doneBy: null, doneAt: null } } }, { returnDocument: 'after' }).lean();
    if (!updated) return res.status(404).json({ message: 'Ese checklist ya no está.' });
    res.status(201).json({ checklist: view(updated) });
    announce(updated);
  }));

  router.delete('/checklists/:id', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const checklist = await checklistOfMember(req.params.id, userId, res);
    if (!checklist) return;
    if (String(checklist.createdBy) !== String(userId)) return res.status(403).json({ message: 'Solo quien lo creó lo borra.' });
    await ChecklistModel.deleteOne({ _id: checklist._id });
    res.json({ ok: true });
    announce(checklist);
  }));

  return router;
}

import { Router, type Response } from 'express';
import { botHearsChecklist } from './bots/botTriggers.js';
import { Types } from 'mongoose';
import { canToggleTask, checklistOverdue, checklistPermissions, checklistTextInChat, toggleChecklistItem, validateChecklist, validateChecklistItem, validateChecklistTitle, type AgendaChecklist } from '@lilachat/shared';
import { ChatModel, MessageModel } from './chatModels.js';
import { ChecklistModel, type Checklist } from './checklistModel.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { avisarCambioDeTarjeta } from './avisoDeTarjeta.js';
import { deleteMessage } from './chatService.js';
import { avisarCambioDeChat, notifyDeleted } from './reparto.js';
import { noteTaskToggle } from './checklistNotices.js';
import { createChecklistInChat, newItemId } from './checklistService.js';

/** A task's own id: 6 random bytes, enough inside one checklist of up to 30. */

/** The checklist as the card reads it (ids as strings). */
export function view(checklist: Checklist): AgendaChecklist {
  return {
    _id: String(checklist._id),
    chatId: String(checklist.chatId),
    createdBy: String(checklist.createdBy),
    title: checklist.title,
    items: checklist.items.map((item) => ({ id: item.id, text: item.text, doneBy: item.doneBy ? String(item.doneBy) : null, doneAt: item.doneAt ? item.doneAt.toISOString() : null, assignee: item.assignee ? String(item.assignee) : null, dueAt: item.dueAt ? item.dueAt.toISOString() : null })),
    othersCanMark: checklist.othersCanMark,
    othersCanAdd: checklist.othersCanAdd,
    createdAt: checklist.createdAt.toISOString(),
    ...(checklist.cardSeq ? { cardSeq: checklist.cardSeq } : {}),
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

/** How many checklists the chat info and «Mis tareas» bring. */
const LIST_LIMIT = 50;
const MINE_LIMIT = 100;

/** The checklist if I may edit its tasks (who made it, or anyone if «los demás pueden agregar»); otherwise answers and null. */
async function editableChecklist(id: unknown, userId: Types.ObjectId, res: Response): Promise<Checklist | null> {
  const checklist = await checklistOfMember(id, userId, res);
  if (!checklist) return null;
  if (!checklistPermissions({ me: String(userId), createdBy: String(checklist.createdBy), othersCanMark: checklist.othersCanMark, othersCanAdd: checklist.othersCanAdd }).canAdd) {
    res.status(403).json({ message: 'Solo quien lo creó edita las tareas.' });
    return null;
  }
  return checklist;
}

/** What a task edit asks for, checked: the text, an assignee who is in the chat, a date. */
async function taskChanges(body: Record<string, unknown>, checklist: Checklist, itemId: string): Promise<Record<string, unknown> | { message: string }> {
  const changes: Record<string, unknown> = {};
  if (body.text !== undefined) {
    const valid = validateChecklistItem(String(body.text), checklist.items.filter((one) => one.id !== itemId));
    if (!valid.ok) return { message: valid.message };
    changes.text = valid.text;
  }
  if (body.assignee !== undefined) {
    if (body.assignee === null) changes.assignee = null;
    else if (typeof body.assignee === 'string' && Types.ObjectId.isValid(body.assignee) && (await ChatModel.exists({ _id: checklist.chatId, 'members.userId': body.assignee }))) changes.assignee = new Types.ObjectId(body.assignee);
    else return { message: 'El responsable tiene que ser del chat.' };
  }
  if (body.dueAt !== undefined) {
    const due = body.dueAt === null ? null : new Date(String(body.dueAt));
    if (due && Number.isNaN(due.getTime())) return { message: 'Elige una fecha válida.' };
    changes.dueAt = due;
  }
  return changes;
}


/**
 * Checklists made before 0.1.122 did not keep the seq of their card: it is
 * looked up once, in one query, and kept, so the chat info and «Mis tareas»
 * can jump to it.
 */
async function withCardSeq<T extends Pick<Checklist, '_id' | 'chatId' | 'cardSeq'>>(checklists: T[]): Promise<T[]> {
  const missing = checklists.filter((checklist) => !checklist.cardSeq);
  if (missing.length === 0) return checklists;
  const cards = await MessageModel.find({ chatId: { $in: missing.map((checklist) => checklist.chatId) }, 'ref.tipo': 'checklist', 'ref.id': { $in: missing.map((checklist) => String(checklist._id)) } }).select('seq ref').lean();
  const seqOf = new Map(cards.map((card) => [String(card.ref?.id), card.seq]));
  await Promise.all(missing.filter((checklist) => seqOf.has(String(checklist._id))).map((checklist) => ChecklistModel.updateOne({ _id: checklist._id }, { $set: { cardSeq: seqOf.get(String(checklist._id)) } })));
  return checklists.map((checklist) => (checklist.cardSeq || !seqOf.has(String(checklist._id)) ? checklist : { ...checklist, cardSeq: seqOf.get(String(checklist._id)) }));
}

/** Deletes a checklist's card for everyone; the chat list and the pinned bar reload. */
async function deleteCard(checklist: Checklist, userId: Types.ObjectId): Promise<void> {
  const chatId = String(checklist.chatId);
  const deleted = await deleteMessage({ chatId, seq: checklist.cardSeq!, userId });
  if (!deleted.ok) return;
  const members = (await ChatModel.findById(chatId).select('members.userId').lean())?.members.map((member) => String(member.userId)) ?? [];
  notifyDeleted(chatId, checklist.cardSeq!, members, deleted.hilo && deleted.message.hiloDe ? { rootSeq: deleted.message.hiloDe, summary: deleted.hilo } : undefined);
  for (const member of members) avisarCambioDeChat(member, chatId);
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
    const created = await createChecklistInChat({
      chatId: String(chatId),
      createdBy: userId,
      title: valid.title,
      items: valid.items.map((text) => ({ text })),
      othersCanMark: req.body?.othersCanMark !== false,
      othersCanAdd: req.body?.othersCanAdd !== false,
      hiloDe: Number.isInteger(req.body?.hiloDe) ? Number(req.body.hiloDe) : undefined,
      pin: req.body?.pin !== false,
    });
    res.status(201).json({ id: created.id });
  }));

  /** «Mis tareas» (backlog 30): the checklists of my chats with a task assigned to me; the app groups them (`myTasks`). */
  router.get('/checklists/mine', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const chats = await ChatModel.find({ 'members.userId': userId }).select('_id').lean();
    const checklists = await withCardSeq(await ChecklistModel.find({ chatId: { $in: chats.map((chat) => chat._id) }, items: { $elemMatch: { assignee: userId, doneBy: null } } }).sort({ createdAt: -1 }).limit(MINE_LIMIT).lean());
    res.json({ checklists: checklists.map((checklist) => ({ ...view(checklist), items: view(checklist).items.filter((item) => item.assignee === String(userId) && !item.doneBy) })) });
  }));

  /** The checklists of a chat, for its info (backlog 30): progress and overdue tasks, the newest first. */
  router.get('/checklists', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const chatId = typeof req.query.chatId === 'string' && Types.ObjectId.isValid(req.query.chatId) ? req.query.chatId : null;
    if (!chatId || !(await ChatModel.exists({ _id: chatId, 'members.userId': userId }))) return res.status(403).json({ message: 'No tienes acceso a esa conversación.' });
    const checklists = await withCardSeq(await ChecklistModel.find({ chatId, stage: { $exists: false } }).sort({ createdAt: -1 }).limit(LIST_LIMIT).lean());
    const now = new Date();
    res.json({
      checklists: checklists.map((checklist) => {
        const items = view(checklist).items;
        return { _id: String(checklist._id), title: checklist.title, done: items.filter((item) => item.doneBy).length, total: items.length, overdue: checklistOverdue(items, now), ...(checklist.cardSeq ? { cardSeq: checklist.cardSeq } : {}) };
      }),
    });
  }));

  router.get('/checklists/:id', asyncRoute(async (req, res) => {
    const checklist = await checklistOfMember(req.params.id, req.session!.userId, res);
    if (checklist) res.json({ checklist: view(checklist) });
  }));

  router.post('/checklists/:id/items/:itemId/toggle', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const checklist = await checklistOfMember(req.params.id, userId, res);
    if (!checklist) return;
    const task = checklist.items.find((one) => one.id === String(req.params.itemId));
    const assignee = task?.assignee ? String(task.assignee) : null;
    if (task && !canToggleTask({ me: String(userId), createdBy: String(checklist.createdBy), othersCanMark: checklist.othersCanMark, assignee })) {
      return res.status(403).json({ message: assignee ? 'Esta tarea tiene responsable: solo esa persona o quien creó el checklist la marca.' : 'Solo quien lo creó marca las tareas.' });
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
    noteTaskToggle(String(updated._id), String(userId), item.id, Boolean(item.doneBy));
    // A bot's checklist (`bots/`): the bot hears which task changed and who did it.
    void botHearsChecklist({ checklist: updated, item: { id: item.id, text: before.text, done: Boolean(item.doneBy), assignee: before.assignee ?? null }, userId }).catch((error) =>
      console.error('[bots] no se pudo avisar la tarea:', error instanceof Error ? error.message : error)
    );
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

  router.patch('/checklists/:id/items/:itemId', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const checklist = await editableChecklist(req.params.id, userId, res);
    if (!checklist) return;
    const item = checklist.items.find((one) => one.id === req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Esa tarea ya no está.' });
    const changes = await taskChanges(req.body ?? {}, checklist, item.id);
    if ('message' in changes) return res.status(400).json({ message: changes.message });
    const set = Object.fromEntries(Object.entries(changes).map(([field, value]) => [`items.$.${field}`, value]));
    const updated = await ChecklistModel.findOneAndUpdate({ _id: checklist._id, 'items.id': item.id }, { $set: set }, { returnDocument: 'after' }).lean();
    if (!updated) return res.status(404).json({ message: 'Esa tarea ya no está.' });
    res.json({ checklist: view(updated) });
    announce(updated);
  }));

  router.delete('/checklists/:id/items/:itemId', asyncRoute(async (req, res) => {
    const checklist = await editableChecklist(req.params.id, req.session!.userId, res);
    if (!checklist) return;
    if (!checklist.items.some((one) => one.id === req.params.itemId)) return res.status(404).json({ message: 'Esa tarea ya no está.' });
    if (checklist.items.length <= 1) return res.status(400).json({ message: 'Un checklist lleva al menos una tarea.' });
    const updated = await ChecklistModel.findByIdAndUpdate(checklist._id, { $pull: { items: { id: req.params.itemId } } }, { returnDocument: 'after' }).lean();
    if (!updated) return res.status(404).json({ message: 'Ese checklist ya no está.' });
    res.json({ checklist: view(updated) });
    announce(updated);
  }));

  /** Its author renames it and decides again who ticks and adds (José, 21/10: «¿cómo edito un checklist?»). */
  router.patch('/checklists/:id', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const checklist = await checklistOfMember(req.params.id, userId, res);
    if (!checklist) return;
    if (String(checklist.createdBy) !== String(userId)) return res.status(403).json({ message: 'Solo quien lo creó lo edita.' });
    const set: Partial<Pick<Checklist, 'title' | 'othersCanMark' | 'othersCanAdd'>> = {};
    if (req.body?.title !== undefined) {
      const valid = validateChecklistTitle(String(req.body.title));
      if (!valid.ok) return res.status(400).json({ message: valid.message });
      set.title = valid.title;
    }
    if (typeof req.body?.othersCanMark === 'boolean') set.othersCanMark = req.body.othersCanMark;
    if (typeof req.body?.othersCanAdd === 'boolean') set.othersCanAdd = req.body.othersCanAdd;
    const updated = await ChecklistModel.findByIdAndUpdate(checklist._id, { $set: set }, { returnDocument: 'after' }).lean();
    if (!updated) return res.status(404).json({ message: 'Ese checklist ya no está.' });
    // The chat list and the pinned bar read the card's text.
    if (set.title && updated.cardSeq) await MessageModel.updateOne({ chatId: updated.chatId, seq: updated.cardSeq }, { $set: { body: checklistTextInChat(set.title) } });
    res.json({ checklist: view(updated) });
    announce(updated);
  }));

  router.delete('/checklists/:id', asyncRoute(async (req, res) => {
    const userId = req.session!.userId;
    const checklist = await checklistOfMember(req.params.id, userId, res);
    if (!checklist) return;
    if (String(checklist.createdBy) !== String(userId)) return res.status(403).json({ message: 'Solo quien lo creó lo borra.' });
    await ChecklistModel.deleteOne({ _id: checklist._id });
    // Its card goes too, like a deleted message (it is its author's): unpinned, and a thread recounts.
    if (checklist.cardSeq) await deleteCard(checklist, userId);
    res.json({ ok: true });
    announce(checklist);
  }));

  return router;
}

import { Router } from 'express';
import { Types } from 'mongoose';
import { checklistPermissions, type QueueItem } from '@lilachat/shared';
import { ChatModel, MessageModel } from './chatModels.js';
import { ChecklistModel } from './checklistModel.js';
import { EventModel, PollModel, ReminderModel } from './eventModels.js';
import { asyncRoute, requireSession } from './requireSession.js';

/**
 * The cards queued over the writing bar (backlog 36, José 21/10;
 * `shared/chatQueue.ts`): what is pending for ME in one chat, derived from
 * what already exists — my late tasks, polls I did not vote, events I did not
 * answer and reminders that rang today. Doing the thing makes it go; nothing
 * is stored here.
 */
const DAY_MS = 24 * 3_600_000;
/** A few of each kind: it is a queue to work through, not a list to read. */
const PER_KIND = 10;
/** Across all my chats: enough for every list's markers, still one small query per kind. */
const KEYS_LIMIT = 300;
const CARD_KIND = { event: 'evento', poll: 'encuesta', reminder: 'recordatorio' } as const;

type Ids = { chatIds: Types.ObjectId[]; me: Types.ObjectId; now: Date; limit: number };
/** A pending item and the chat it belongs to: one query serves one chat or all of mine. */
type Pending = { chatId: string; item: QueueItem };

async function lateTasks({ chatIds, me, now, limit }: Ids): Promise<Pending[]> {
  const checklists = await ChecklistModel.find({ chatId: { $in: chatIds }, items: { $elemMatch: { assignee: me, doneBy: null, dueAt: { $lt: now } } } }).limit(limit).lean();
  return checklists.flatMap((checklist) => {
    const canPostpone = checklistPermissions({ me: String(me), createdBy: String(checklist.createdBy), othersCanMark: checklist.othersCanMark, othersCanAdd: checklist.othersCanAdd }).canAdd;
    return checklist.items
      .filter((item) => item.assignee && item.assignee.equals(me) && !item.doneBy && item.dueAt && item.dueAt < now)
      .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())
      .map((item): Pending => {
        const at = item.dueAt!.toISOString();
        return { chatId: String(checklist.chatId), item: { kind: 'task', key: `task:${checklist._id}:${item.id}:${at}`, title: item.text, context: checklist.title, at, checklistId: String(checklist._id), itemId: item.id, canPostpone, ...(checklist.cardSeq ? { seq: checklist.cardSeq } : {}) } };
      });
  });
}

async function otherPending({ chatIds, me, now, limit }: Ids): Promise<Pending[]> {
  const inChats = { $in: chatIds };
  const [events, polls, reminders] = await Promise.all([
    EventModel.find({ chatId: inChats, startsAt: { $gte: now }, createdBy: { $ne: me }, attendees: { $elemMatch: { userId: me, rsvp: null } } }).sort({ startsAt: 1 }).limit(limit).select('chatId title startsAt').lean(),
    PollModel.find({ chatId: inChats, closedAt: null, createdBy: { $ne: me }, 'options.votes': { $ne: me } }).sort({ _id: -1 }).limit(limit).select('chatId question').lean(),
    ReminderModel.find({ chatId: inChats, recurrence: 'once', active: false, startsAt: { $gte: new Date(now.getTime() - DAY_MS), $lte: now } }).sort({ startsAt: -1 }).limit(limit).select('chatId title startsAt').lean(),
  ]);
  return [
    ...events.map((event): Pending => ({ chatId: String(event.chatId), item: { kind: 'event', key: `event:${event._id}:${event.startsAt.toISOString()}`, title: event.title, at: event.startsAt.toISOString(), eventId: String(event._id) } })),
    ...polls.map((poll): Pending => ({ chatId: String(poll.chatId), item: { kind: 'poll', key: `poll:${poll._id}`, title: poll.question, pollId: String(poll._id) } })),
    ...reminders.map((reminder): Pending => ({ chatId: String(reminder.chatId), item: { kind: 'reminder', key: `reminder:${reminder._id}:${reminder.startsAt.toISOString()}`, title: reminder.title, at: reminder.startsAt.toISOString(), reminderId: String(reminder._id) } })),
  ];
}

/** The card of each event, poll and reminder in the chat, so a tap opens it: one query for all. */
async function withCards(chatId: Types.ObjectId, items: QueueItem[]): Promise<QueueItem[]> {
  const idOf = (item: QueueItem) => (item.kind === 'event' ? item.eventId : item.kind === 'poll' ? item.pollId : item.kind === 'reminder' ? item.reminderId : null);
  const ids = items.map(idOf).filter((id): id is string => id !== null);
  if (ids.length === 0) return items;
  const cards = await MessageModel.find({ chatId, 'ref.id': { $in: ids }, deletedAt: null }).select('seq ref').lean();
  const seqOf = new Map(cards.map((card) => [`${card.ref?.tipo}:${card.ref?.id}`, card.seq]));
  return items.map((item) => {
    if (item.kind === 'task') return item;
    const seq = seqOf.get(`${CARD_KIND[item.kind]}:${idOf(item)}`);
    return seq ? { ...item, seq } : item;
  });
}

export function buildQueueRouter(): Router {
  const router = Router();
  // Session per route: this router shares `/api/agenda` with others (see `pendientesRoutes.ts`).
  router.get('/queue', requireSession, asyncRoute(async (req, res) => {
    const me = req.session!.userId;
    const raw = typeof req.query.chatId === 'string' ? req.query.chatId : '';
    const chatId = Types.ObjectId.isValid(raw) ? new Types.ObjectId(raw) : null;
    if (!chatId || !(await ChatModel.exists({ _id: chatId, 'members.userId': me }))) return void res.status(403).json({ message: 'No tienes acceso a esa conversación.' });
    const ids = { chatIds: [chatId], me: new Types.ObjectId(me), now: new Date(), limit: PER_KIND };
    const [tasks, others] = await Promise.all([lateTasks(ids), otherPending(ids)]);
    res.json({ items: [...tasks.map((one) => one.item), ...(await withCards(chatId, others.map((one) => one.item)))] });
  }));
  /**
   * The keys of what is pending in each of my chats (José, 22/10: the list did
   * not say a chat had something waiting). The list counts them minus the
   * ones dismissed on that device; the same keys as each chat's queue.
   */
  router.get('/queue/keys', requireSession, asyncRoute(async (req, res) => {
    const me = new Types.ObjectId(req.session!.userId);
    const chatIds = (await ChatModel.find({ 'members.userId': me }).select('_id').lean()).map((chat) => chat._id);
    const ids = { chatIds, me, now: new Date(), limit: KEYS_LIMIT };
    const [tasks, others] = await Promise.all([lateTasks(ids), otherPending(ids)]);
    const pending: Record<string, string[]> = {};
    for (const { chatId, item } of [...tasks, ...others]) (pending[chatId] ??= []).push(item.key);
    res.json({ pending });
  }));
  return router;
}

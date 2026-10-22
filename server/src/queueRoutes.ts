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
const CARD_KIND = { event: 'evento', poll: 'encuesta', reminder: 'recordatorio' } as const;

type Ids = { chatId: Types.ObjectId; me: Types.ObjectId; now: Date };

async function lateTasks({ chatId, me, now }: Ids): Promise<QueueItem[]> {
  const checklists = await ChecklistModel.find({ chatId, items: { $elemMatch: { assignee: me, doneBy: null, dueAt: { $lt: now } } } }).limit(PER_KIND).lean();
  return checklists.flatMap((checklist) => {
    const canPostpone = checklistPermissions({ me: String(me), createdBy: String(checklist.createdBy), othersCanMark: checklist.othersCanMark, othersCanAdd: checklist.othersCanAdd }).canAdd;
    return checklist.items
      .filter((item) => item.assignee && item.assignee.equals(me) && !item.doneBy && item.dueAt && item.dueAt < now)
      .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())
      .map((item): QueueItem => {
        const at = item.dueAt!.toISOString();
        return { kind: 'task', key: `task:${checklist._id}:${item.id}:${at}`, title: item.text, context: checklist.title, at, checklistId: String(checklist._id), itemId: item.id, canPostpone, ...(checklist.cardSeq ? { seq: checklist.cardSeq } : {}) };
      });
  });
}

async function otherPending({ chatId, me, now }: Ids): Promise<QueueItem[]> {
  const [events, polls, reminders] = await Promise.all([
    EventModel.find({ chatId, startsAt: { $gte: now }, createdBy: { $ne: me }, attendees: { $elemMatch: { userId: me, rsvp: null } } }).sort({ startsAt: 1 }).limit(PER_KIND).select('title startsAt').lean(),
    PollModel.find({ chatId, closedAt: null, createdBy: { $ne: me }, 'options.votes': { $ne: me } }).sort({ _id: -1 }).limit(PER_KIND).select('question').lean(),
    ReminderModel.find({ chatId, recurrence: 'once', active: false, startsAt: { $gte: new Date(now.getTime() - DAY_MS), $lte: now } }).sort({ startsAt: -1 }).limit(PER_KIND).select('title startsAt').lean(),
  ]);
  return [
    ...events.map((event): QueueItem => ({ kind: 'event', key: `event:${event._id}:${event.startsAt.toISOString()}`, title: event.title, at: event.startsAt.toISOString(), eventId: String(event._id) })),
    ...polls.map((poll): QueueItem => ({ kind: 'poll', key: `poll:${poll._id}`, title: poll.question, pollId: String(poll._id) })),
    ...reminders.map((reminder): QueueItem => ({ kind: 'reminder', key: `reminder:${reminder._id}:${reminder.startsAt.toISOString()}`, title: reminder.title, at: reminder.startsAt.toISOString(), reminderId: String(reminder._id) })),
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
    const ids = { chatId, me, now: new Date() };
    const [tasks, others] = await Promise.all([lateTasks(ids), otherPending(ids)]);
    res.json({ items: [...tasks, ...(await withCards(chatId, others))] });
  }));
  return router;
}

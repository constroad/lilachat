import { taskDoneNotices } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { ChecklistModel } from './checklistModel.js';
import { UserModel } from './models.js';
import { notifyTasksDone } from './pushService.js';

/**
 * Ticks wait a minute before they are told (backlog 35): three tasks ticked in
 * a row are one notice, and a task ticked and unticked by mistake is none.
 * Kept in memory, per checklist and person: a restart loses at most a
 * minute of notices, which only say what the card already shows.
 */
const DEFAULT_WAIT_MS = 60_000;
let waitMs = DEFAULT_WAIT_MS;
const pending = new Map<string, { checklistId: string; who: string; itemIds: Set<string>; timer: ReturnType<typeof setTimeout> }>();

/** Tests shorten the wait. */
export function configureTaskNotices(options: { waitMs: number }): void {
  waitMs = options.waitMs;
}

/** A task was ticked or unticked by someone: it joins (or leaves) their pending notice. */
export function noteTaskToggle(checklistId: string, who: string, itemId: string, done: boolean): void {
  const key = `${checklistId}:${who}`;
  const entry = pending.get(key) ?? { checklistId, who, itemIds: new Set<string>(), timer: setTimeout(() => void flush(key), waitMs) };
  // A pending notice never keeps the process alive (tests, a restart).
  entry.timer.unref?.();
  if (done) entry.itemIds.add(itemId);
  else entry.itemIds.delete(itemId);
  pending.set(key, entry);
}

async function flush(key: string): Promise<void> {
  const entry = pending.get(key);
  pending.delete(key);
  if (!entry || entry.itemIds.size === 0) return;
  try {
    const checklist = await ChecklistModel.findById(entry.checklistId).lean();
    if (!checklist) return;
    // Only what is still ticked by that person when the minute is up.
    const ticked = checklist.items.filter((item) => entry.itemIds.has(item.id) && String(item.doneBy) === entry.who);
    const [user, chat] = await Promise.all([UserModel.findById(entry.who).select('name phone').lean(), ChatModel.findById(checklist.chatId).select('kind name').lean()]);
    const notices = taskDoneNotices({
      checklist: {
        title: checklist.title,
        createdBy: String(checklist.createdBy),
        total: checklist.items.length,
        done: checklist.items.filter((item) => item.doneBy).length,
        assignees: checklist.items.flatMap((item) => (item.assignee ? [String(item.assignee)] : [])),
      },
      who: entry.who,
      whoName: user?.name ?? user?.phone ?? 'Alguien',
      ticked: ticked.map((item) => ({ text: item.text, assignee: item.assignee ? String(item.assignee) : null })),
    });
    await notifyTasksDone({ chatId: String(checklist.chatId), seq: checklist.cardSeq, title: chat?.kind === 'group' && chat.name ? chat.name : 'Checklist', notices });
  } catch (error) {
    console.error('[checklist] aviso de tareas falló:', error instanceof Error ? error.message : error);
  }
}

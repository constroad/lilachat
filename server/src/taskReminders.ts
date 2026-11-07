import { Types } from 'mongoose';
import { assignedNotice, taskReminderPlan } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { ChecklistModel, type Checklist, type ChecklistTask } from './checklistModel.js';
import { ReminderModel } from './eventModels.js';
import { pushTo } from './reminderCron.js';
import { WorkspaceModel } from './workspaceModels.js';

type TaskPlace = Pick<Checklist, '_id' | 'chatId' | 'title'>;

/** A space's switch for task notices: off unless an admin turned it on (a chat outside a space has none). */
async function spaceNoticesOf(chatId: Types.ObjectId): Promise<{ on: boolean; chatName: string }> {
  const chat = await ChatModel.findById(chatId).select('workspaceId name').lean();
  const space = chat?.workspaceId ? await WorkspaceModel.findById(chat.workspaceId).select('taskNotices').lean() : null;
  return { on: space?.taskNotices === true, chatName: chat?.name ?? 'Tarea' };
}

/** Keeps the person's reminder in step with the task: the same document, moved, or turned off. Never lets an edit fail. */
export async function syncTaskReminder(checklist: TaskPlace, task: ChecklistTask): Promise<void> {
  try {
    const { on, chatName } = await spaceNoticesOf(checklist.chatId);
    const plan = taskReminderPlan({ assignee: task.assignee ? String(task.assignee) : null, dueAt: task.dueAt?.toISOString() ?? null, doneBy: task.doneBy ? String(task.doneBy) : null, ...(task.advance ? { advance: task.advance } : {}) }, on, new Date());
    if (!plan) {
      if (task.reminderId) await ReminderModel.updateOne({ _id: task.reminderId }, { $set: { active: false } });
      return;
    }
    const fields = { userId: new Types.ObjectId(plan.userId), title: task.text, note: chatName, startsAt: new Date(plan.startsAt), advance: plan.advance, advanceSent: [], remindedAt: null, active: true };
    if (task.reminderId) {
      await ReminderModel.updateOne({ _id: task.reminderId }, { $set: fields });
      return;
    }
    const created = await ReminderModel.create({ ...fields, taskRef: { chatId: checklist.chatId, checklistId: checklist._id, itemId: task.id } });
    await ChecklistModel.updateOne({ _id: checklist._id, 'items.id': task.id }, { $set: { 'items.$.reminderId': created._id } });
  } catch (error) {
    console.error('[tareas] no se pudo sincronizar el recordatorio:', error instanceof Error ? error.message : error);
  }
}

/** A removed task or checklist takes its reminders with it. */
export async function dropTaskReminders(tasks: readonly Pick<ChecklistTask, 'reminderId'>[]): Promise<void> {
  const ids = tasks.flatMap((task) => task.reminderId ?? []);
  if (!ids.length) return;
  try {
    await ReminderModel.updateMany({ _id: { $in: ids } }, { $set: { active: false } });
  } catch (error) {
    console.error('[tareas] no se pudo apagar el recordatorio:', error instanceof Error ? error.message : error);
  }
}

/** Tells the person a task is now theirs. It says what the card already shows, so a failure only logs. */
export async function noticeTaskAssigned(checklist: TaskPlace, params: { before?: Types.ObjectId | null; task: ChecklistTask; actor: string }): Promise<void> {
  try {
    const { on, chatName } = await spaceNoticesOf(checklist.chatId);
    const notice = assignedNotice({ before: params.before ? String(params.before) : null, after: params.task.assignee ? String(params.task.assignee) : null, actor: params.actor, spaceNotices: on, text: params.task.text });
    if (notice) await pushTo([notice.to], chatName, notice.body, { chatId: String(checklist.chatId), seq: 0 });
  } catch (error) {
    console.error('[tareas] no se pudo avisar la asignación:', error instanceof Error ? error.message : error);
  }
}

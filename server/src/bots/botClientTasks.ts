import { Types } from 'mongoose';
import { CHECKLIST_LIMITS, DEFAULT_WORK_STAGES, ORDER_TASKS_STAGE, validateClientTasks, type ClientTask, type ClientTaskState } from '@lilachat/shared';
import { avisarCambioDeTarjeta } from '../avisoDeTarjeta.js';
import { ChecklistModel } from '../checklistModel.js';
import { UserModel } from '../models.js';
import { newItemId } from '../checklistService.js';
import { syncTaskReminder } from '../taskReminders.js';
import { ClientChannelModel } from './botClients.js';
import { assigneesOf, type BotApiError } from './botMessages.js';
import type { BotInstallation } from './botModels.js';

type Installation = Pick<BotInstallation, '_id' | 'appId' | 'workspaceId' | 'botUserId'>;
type TasksAdded = { status: 200 | 201; added: number };

const fail = (status: BotApiError['status'], error: string, message: string): BotApiError => ({ status, error, message });

/** The seven stages, for a channel that has none yet; the ones it has stay as they are. */
export async function ensureWorkStages(chatId: Types.ObjectId, createdBy: Types.ObjectId): Promise<void> {
  await ChecklistModel.bulkWrite(DEFAULT_WORK_STAGES.map((title, index) => ({
    updateOne: { filter: { chatId, stage: index + 1 }, update: { $setOnInsert: { createdBy, title, items: [], othersCanMark: true, othersCanAdd: true } }, upsert: true },
  })));
}

const stageTask = (task: ClientTask, key: string, addedBy: Types.ObjectId, assignees: Map<string, Types.ObjectId>) => ({
  id: newItemId(),
  text: task.text,
  addedBy,
  sourceKey: key,
  ...(task.key ? { taskKey: task.key } : {}),
  doneBy: null,
  doneAt: null,
  assignee: task.assigneePhone ? assignees.get(task.assigneePhone)! : null,
  dueAt: task.dueAt ? new Date(task.dueAt) : null,
});

const channelOfClient = (installation: Installation, clientId: string) => ClientChannelModel.findOne({ workspaceId: installation.workspaceId, appId: installation.appId, clientId }).select('chatId').lean();
const NO_CHANNEL = fail(404, 'client_not_found', 'Ese cliente no tiene canal en este espacio.');

/** `GET /api/bots/clients/:clientId/tasks?key=`: where an order's tasks stand now, so a notice reads the state instead of keeping every event. */
export async function clientTasksOf(installation: Installation, clientId: string, key: unknown): Promise<{ tasks: ClientTaskState[] } | BotApiError> {
  if (typeof key !== 'string' || !key.trim()) return fail(400, 'invalid_request', 'Falta key.');
  const channel = await channelOfClient(installation, clientId);
  if (!channel) return NO_CHANNEL;
  const stage = await ChecklistModel.findOne({ chatId: channel.chatId, stage: ORDER_TASKS_STAGE }).select('items').lean();
  const tasks = (stage?.items ?? []).filter((item) => item.sourceKey === key);
  const assignees = tasks.flatMap((item) => item.assignee ?? []);
  const people = assignees.length ? await UserModel.find({ _id: { $in: assignees } }).select('phone').lean() : [];
  const phones = new Map(people.map((person) => [String(person._id), person.phone]));
  return {
    tasks: tasks.map((item) => ({ id: item.id, key: item.taskKey ?? null, text: item.text, done: Boolean(item.doneBy), done_at: item.doneAt?.toISOString() ?? null, assignee_phone: item.assignee ? (phones.get(String(item.assignee)) ?? null) : null, due_at: item.dueAt?.toISOString() ?? null })),
  };
}

/**
 * `POST /api/bots/clients/:clientId/tasks`: an order's field checklist goes to «Ejecución» (José 06/11).
 * The same `key` twice adds nothing, in one atomic step: an order's event can arrive again.
 */
export async function addClientTasks(installation: Installation, clientId: string, raw: unknown): Promise<TasksAdded | BotApiError> {
  const valid = validateClientTasks(raw);
  if (!valid.ok) return fail(400, 'invalid_request', valid.message);
  const { key, items } = valid.tasks;
  const channel = await channelOfClient(installation, clientId);
  if (!channel) return NO_CHANNEL;
  const assignees = await assigneesOf(installation, { items });
  if (!(assignees instanceof Map)) return assignees;
  await ensureWorkStages(channel.chatId, installation.botUserId);
  const stage = { chatId: channel.chatId, stage: ORDER_TASKS_STAGE };
  const room = `items.${CHECKLIST_LIMITS.stageItems - items.length}`;
  const updated = await ChecklistModel.findOneAndUpdate({ ...stage, 'items.sourceKey': { $ne: key }, [room]: { $exists: false } }, { $push: { items: { $each: items.map((task) => stageTask(task, key, installation.botUserId, assignees)) } } }, { returnDocument: 'after' }).lean();
  if (updated) {
    void avisarCambioDeTarjeta({ chatId: channel.chatId, tipo: 'checklist', id: updated._id });
    for (const task of updated.items.filter((one) => one.sourceKey === key && one.assignee)) void syncTaskReminder(updated, task);
    return { status: 201, added: items.length };
  }
  if (await ChecklistModel.exists({ ...stage, 'items.sourceKey': key })) return { status: 200, added: 0 };
  return fail(409, 'stage_full', `«Ejecución» lleva hasta ${CHECKLIST_LIMITS.stageItems} tareas.`);
}

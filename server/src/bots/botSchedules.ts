import { Types } from 'mongoose';
import { canManageMembers, enabledAt, firstRunAt, itemSettingOf, mayUseItem, recurrenceOf, nextRepeat, scheduleDecision, schedulePlaceProblem, SCHEDULE_LIMITS, type ScheduleInput, type ScheduleRow, type SuggestedSchedule } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { commandAnswerTimeoutMs, itemPlaceOf, judgeReply, type Base, type ChatOfCommand } from './botCommands.js';
import { callBotWebhook } from './botEvents.js';
import { directWith } from './botMessages.js';
import { BotAppModel, BotCommandRunModel, BotInstallationModel, type BotApp, type BotInstallation } from './botModels.js';
import { deliverScheduledAnswer, recordScheduleRun, tellScheduleCreator } from './botScheduleDelivery.js';
import { channelOf, personOf } from './botTriggers.js';
import { AppScheduleModel, type AppSchedule } from './scheduleModels.js';

/**
 * Schedules of an installed app (José, 28/10; agentes COMANDOS-Y-HORARIOS §3):
 * an admin programs a read command in a channel or in their own 1:1 with the
 * app; it runs AS that admin, and place and permission are checked again
 * every time it fires.
 */
export type ScheduleError = { status: 400 | 403 | 404 | 409; message: string };
type Installation = BotInstallation;
const MAX_PER_TICK = 20;
/** A scheduled run answers by /respond within the same 15 minutes as a typed command. */
const RUN_TTL_MS = 15 * 60_000;
/** A rule with no next slot (it cannot happen with days or «every N»): look again tomorrow, never in a loop. */
const NO_SLOT_RETRY_MS = 24 * 3_600_000;

const fail = (status: ScheduleError['status'], message: string): ScheduleError => ({ status, message });

/** The schedules of the app in the space, and what the app suggests that nobody created yet. */
export async function schedulesOf(installation: Installation): Promise<{ schedules: ScheduleRow[]; suggested: SuggestedSchedule[] }> {
  const [rows, app] = await Promise.all([AppScheduleModel.find({ installationId: installation._id }).sort({ createdAt: 1 }).lean(), BotAppModel.findById(installation.appId).select('suggestedSchedules').lean()]);
  const chats = await ChatModel.find({ _id: { $in: rows.map((row) => row.chatId) } }).select('_id kind name').lean();
  const byId = new Map(chats.map((chat) => [String(chat._id), chat]));
  const schedules = rows.map((row): ScheduleRow => {
    const chat = byId.get(String(row.chatId));
    const where = chat?.kind === 'group' ? { kind: 'channel' as const, chatId: String(chat._id), name: chat.name ?? '' } : { kind: 'direct' as const };
    return { id: String(row._id), command: row.command, text: row.text, time: row.time, repeat: row.repeat, onlyIfSomething: row.onlyIfSomething, active: row.active, where, createdBy: String(row.createdBy), ...(row.lastRun ? { lastRun: { ...row.lastRun, scheduledFor: row.lastRun.scheduledFor.toISOString(), at: row.lastRun.at.toISOString() } } : {}) };
  });
  const taken = (suggestion: SuggestedSchedule) => rows.some((row) => row.command === suggestion.command && row.text === suggestion.text && row.time === suggestion.time);
  return { schedules, suggested: (app?.suggestedSchedules ?? []).filter((suggestion) => !taken(suggestion)) };
}

/** The chat it posts in: a channel of the space where the creator and the app are, or the creator's 1:1 with the app. */
async function chatFor(installation: Installation, creator: Types.ObjectId, place: ScheduleInput['place'], appName: string): Promise<ChatOfCommand | ScheduleError> {
  if (place === 'direct') {
    const chatId = await directWith(installation, creator);
    return (await ChatModel.findById(chatId).select('_id kind name channel workspaceId members.userId').lean<ChatOfCommand | null>()) ?? fail(404, 'No se encontró tu chat con la app.');
  }
  const chat = await ChatModel.findOne({ _id: place.chatId, workspaceId: installation.workspaceId, kind: 'group', 'members.userId': creator }).select('_id kind name channel workspaceId members.userId').lean<ChatOfCommand | null>();
  if (!chat) return fail(404, 'Ese canal no existe en el espacio o no estás en él.');
  if (!chat.members.some((member) => String(member.userId) === String(installation.botUserId))) return fail(409, `${appName} no está en #${chat.name ?? 'ese canal'}: agrégala en Ajustes.`);
  return chat;
}

/** Why the creator may not run it there (also when it fires): not schedulable, amounts in a channel, or not on for them there. */
function problemFor(installation: Pick<Installation, 'itemSettings' | 'itemsV2' | 'botUserId'>, app: Pick<BotApp, 'commands'>, command: string, chat: ChatOfCommand, spaceAdmin: boolean, creator: Types.ObjectId): string | null {
  const known = app.commands?.find((entry) => entry.command === command);
  if (!known) return `La app ya no tiene /${command}.`;
  const placeProblem = schedulePlaceProblem(known, chat.kind === 'group' ? 'channel' : 'direct');
  if (placeProblem) return placeProblem;
  const setting = itemSettingOf(installation.itemSettings, 'command', command, !installation.itemsV2);
  const where = itemPlaceOf(chat, installation);
  if (!enabledAt(setting, where)) return where === 'direct' ? `/${command} no está encendido en el chat con la app.` : `/${command} no está encendido en #${chat.name ?? 'ese canal'}.`;
  return mayUseItem(setting, { userId: String(creator), spaceAdmin }) ? null : `ya no tienes permiso para usar /${command}.`;
}

export async function createSchedule(installation: Installation, creator: Types.ObjectId, input: ScheduleInput, now = new Date()): Promise<ScheduleRow | ScheduleError> {
  const app = await BotAppModel.findById(installation.appId).select('name commands').lean();
  if (!app) return fail(404, 'Esa app no está instalada en el espacio.');
  if ((await AppScheduleModel.countDocuments({ installationId: installation._id })) >= SCHEDULE_LIMITS.perApp) return fail(409, `Una app tiene hasta ${SCHEDULE_LIMITS.perApp} horarios.`);
  const chat = await chatFor(installation, creator, input.place, app.name);
  if ('status' in chat) return chat;
  const problem = problemFor(installation, app, input.command, chat, true, creator);
  if (problem) return fail(400, problem.charAt(0).toUpperCase() + problem.slice(1));
  const created = await AppScheduleModel.create({ workspaceId: installation.workspaceId, installationId: installation._id, appId: installation.appId, chatId: chat._id, createdBy: creator, command: input.command, text: input.text, time: input.time, repeat: input.repeat, onlyIfSomething: input.onlyIfSomething, active: true, nextRunAt: firstRunAt(input.time, input.repeat, now) });
  const where = chat.kind === 'group' ? { kind: 'channel' as const, chatId: String(chat._id), name: chat.name ?? '' } : { kind: 'direct' as const };
  return { id: String(created._id), command: created.command, text: created.text, time: created.time, repeat: created.repeat, onlyIfSomething: created.onlyIfSomething, active: true, where, createdBy: String(creator) };
}

/** Paused or resumed by an admin; resuming starts from the next slot, never from the ones it skipped. */
export async function setScheduleActive(installation: Installation, scheduleId: string, active: boolean, now = new Date()): Promise<{ ok: true } | ScheduleError> {
  const schedule = Types.ObjectId.isValid(scheduleId) ? await AppScheduleModel.findOne({ _id: scheduleId, installationId: installation._id }).lean() : null;
  if (!schedule) return fail(404, 'Ese horario no existe.');
  await AppScheduleModel.updateOne({ _id: schedule._id }, { $set: { active, ...(active ? { nextRunAt: firstRunAt(schedule.time, schedule.repeat, now) } : {}) } });
  return { ok: true };
}

export async function deleteSchedule(installation: Installation, scheduleId: string): Promise<{ ok: true } | ScheduleError> {
  const deleted = Types.ObjectId.isValid(scheduleId) ? await AppScheduleModel.deleteOne({ _id: scheduleId, installationId: installation._id }) : { deletedCount: 0 };
  return deleted.deletedCount ? { ok: true } : fail(404, 'Ese horario no existe.');
}

/** The slot after this one, in the reminders' repetition. */
const nextSlotOf = (schedule: Pick<AppSchedule, 'nextRunAt' | 'repeat'>, now: Date): Date => {
  const { recurrence, rule } = recurrenceOf(schedule.repeat);
  return nextRepeat({ startsAt: schedule.nextRunAt, recurrence, rule, from: new Date(Math.max(now.getTime(), schedule.nextRunAt.getTime())) }) ?? new Date(now.getTime() + NO_SLOT_RETRY_MS);
};

/**
 * The cron's tick: each due slot is CLAIMED by moving `nextRunAt` forward
 * with a conditional update, so two ticks never run it twice. Later than 30
 * minutes it is missed and the creator is told.
 */
export async function runDueSchedules(now = new Date()): Promise<number> {
  const due = await AppScheduleModel.find({ active: true, nextRunAt: { $lte: now } }).sort({ nextRunAt: 1 }).limit(MAX_PER_TICK).lean();
  let ran = 0;
  for (const schedule of due) {
    const claimed = await AppScheduleModel.updateOne({ _id: schedule._id, nextRunAt: schedule.nextRunAt }, { $set: { nextRunAt: nextSlotOf(schedule, now) } });
    if (claimed.modifiedCount === 0) continue;
    await runSlot(schedule, schedule.nextRunAt, now).catch((error: unknown) => console.error('[schedules] un horario falló:', error instanceof Error ? error.message : error));
    ran += 1;
  }
  return ran;
}

async function runSlot(schedule: AppSchedule, scheduledFor: Date, now: Date): Promise<void> {
  const installation = await BotInstallationModel.findOne({ _id: schedule.installationId, revokedAt: { $exists: false } }).lean();
  if (!installation) return void (await AppScheduleModel.updateOne({ _id: schedule._id }, { $set: { active: false } }));
  const tell = (reason: string) => tellScheduleCreator(installation, { creator: schedule.createdBy, scheduleId: schedule._id, scheduledFor, command: schedule.command, time: schedule.time, reason });
  if (scheduleDecision(scheduledFor, now) === 'missed') {
    await tell('Lilachat no estaba disponible a esa hora.');
    return recordScheduleRun(schedule._id, scheduledFor, 'missed');
  }
  const [app, chat, member] = await Promise.all([
    BotAppModel.findById(installation.appId).select('name commands webhookUrl').lean(),
    ChatModel.findById(schedule.chatId).select('_id kind name channel workspaceId members.userId').lean<ChatOfCommand | null>(),
    WorkspaceMemberModel.findOne({ workspaceId: schedule.workspaceId, userId: schedule.createdBy, status: 'active' }).select('role').lean(),
  ]);
  const problem = !app || !chat ? 'el canal ya no existe.' : !member ? 'ya no eres miembro del espacio.' : problemFor(installation, app, schedule.command, chat, canManageMembers(member.role), schedule.createdBy);
  if (problem || !app || !chat) {
    await tell(problem ?? 'el canal ya no existe.');
    return recordScheduleRun(schedule._id, scheduledFor, 'refused', problem ?? undefined);
  }
  await invokeForSchedule(installation, app, chat, schedule, scheduledFor);
}

/** `command.invoked` with `trigger: 'schedule'` (§3.3), as the creator; the same event id on every retry of the delivery. */
async function invokeForSchedule(installation: Installation, app: Pick<BotApp, '_id' | 'name' | 'webhookUrl'>, chat: ChatOfCommand, schedule: AppSchedule, scheduledFor: Date): Promise<void> {
  const run = await BotCommandRunModel.create({ installationId: installation._id, chatId: chat._id, workspaceId: schedule.workspaceId, userId: schedule.createdBy, command: schedule.command, schedule: { id: schedule._id, scheduledFor, onlyIfSomething: schedule.onlyIfSomething, time: schedule.time }, expiresAt: new Date(Date.now() + RUN_TTL_MS) });
  const user = await personOf(schedule.createdBy, installation.grantedScopes);
  const reply = await callBotWebhook({ ...installation, webhookUrl: app.webhookUrl }, 'command.invoked', { command_id: String(run._id), channel: channelOf(chat), user, command: schedule.command, text: schedule.text, trigger: 'schedule', schedule_id: String(schedule._id), scheduled_for: scheduledFor.toISOString() }, commandAnswerTimeoutMs());
  const base: Base = { commandId: String(run._id), appId: String(app._id), appName: app.name };
  const judged = judgeReply(reply, schedule.command, installation._id, base);
  if ('accepted' in judged) {
    await BotCommandRunModel.updateOne({ _id: run._id }, { $inc: { responses: 1 } });
    await deliverScheduledAnswer(installation, { _id: run._id, userId: schedule.createdBy, command: schedule.command, schedule: { id: schedule._id, scheduledFor, onlyIfSomething: schedule.onlyIfSomething, time: schedule.time } }, chat, judged.accepted);
    return;
  }
  if (judged.outcome === 'pending') return recordScheduleRun(schedule._id, scheduledFor, 'pending');
  await tellScheduleCreator(installation, { creator: schedule.createdBy, scheduleId: schedule._id, scheduledFor, command: schedule.command, time: schedule.time, reason: judged.message ?? `${app.name} no respondió.` });
  await recordScheduleRun(schedule._id, scheduledFor, 'failed', judged.message);
}

export const isSpaceAdminOf = async (workspaceId: string, userId: Types.ObjectId): Promise<boolean> => {
  const member = await WorkspaceMemberModel.findOne({ workspaceId, userId, status: 'active' }).select('role').lean();
  return Boolean(member && canManageMembers(member.role));
};

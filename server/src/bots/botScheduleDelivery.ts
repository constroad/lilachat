import type { Types } from 'mongoose';
import { scheduleNotRunText, type BotPost, type CommandResponse } from '@lilachat/shared';
import type { ChatOfCommand } from './botCommands.js';
import { postBotMessage } from './botMessages.js';
import type { BotCommandRun, BotInstallation } from './botModels.js';
import { AppScheduleModel, type ScheduleOutcome } from './scheduleModels.js';

type ScheduledRun = Pick<BotCommandRun, '_id' | 'userId' | 'command'> & { schedule: NonNullable<BotCommandRun['schedule']> };

/** «How it went», written on the schedule for «Horarios» (design d-03); never awaited by the person. */
export async function recordScheduleRun(scheduleId: Types.ObjectId, scheduledFor: Date, outcome: ScheduleOutcome, message?: string): Promise<void> {
  await AppScheduleModel.updateOne({ _id: scheduleId }, { $set: { lastRun: { scheduledFor, at: new Date(), outcome, ...(message ? { message: message.slice(0, 300) } : {}) } } });
}

/**
 * The creator's 1:1 with the app says why a schedule did not post (agentes
 * COMANDOS-Y-HORARIOS §3.1): nothing is left in anyone else's name. Once per
 * slot: a retry of the same slot does not write it twice.
 */
export async function tellScheduleCreator(installation: BotInstallation, params: { creator: Types.ObjectId; scheduleId: Types.ObjectId; scheduledFor: Date; command: string; time: string; reason: string; card?: BotPost['card'] }): Promise<void> {
  const posted = await postBotMessage(installation, {
    target: { userId: String(params.creator) },
    text: scheduleNotRunText(params.command, params.time, params.reason),
    ...(params.card ? { card: params.card } : {}),
    idempotencyKey: `schedule-note:${params.scheduleId}:${params.scheduledFor.toISOString()}`,
  });
  if ('error' in posted) console.error('[schedules] no se pudo avisar al creador:', posted.message);
}

/**
 * What the app answered for a schedule (§3.3): `in_channel` posts in the
 * schedule's chat, once per slot; `ephemeral` (an error, «conecta tu cuenta»)
 * reaches only the creator; with «solo si hay algo», `nothing_to_report`
 * posts nothing. A form is never scheduled.
 */
export async function deliverScheduledAnswer(installation: BotInstallation, run: ScheduledRun, chat: ChatOfCommand | null, response: CommandResponse): Promise<ScheduleOutcome> {
  const { schedule } = run;
  const tell = (reason: string, card?: BotPost['card']) => tellScheduleCreator(installation, { creator: run.userId, scheduleId: schedule.id, scheduledFor: schedule.scheduledFor, command: run.command, time: schedule.time, reason, ...(card ? { card } : {}) });
  const record = (outcome: ScheduleOutcome, message?: string) => recordScheduleRun(schedule.id, schedule.scheduledFor, outcome, message).then(() => outcome);
  if (response.responseType === 'form') {
    await tell('la app pidió un formulario, y los formularios no se programan.');
    return record('failed', 'La app pidió un formulario.');
  }
  if (response.nothingToReport && schedule.onlyIfSomething) return record('nothing');
  const card = response.card as BotPost['card'] | undefined;
  if (response.responseType === 'ephemeral' || !chat) {
    const reason = response.text ?? 'la app respondió solo para ti.';
    await tell(reason, card);
    return record('failed', reason);
  }
  const target: BotPost['target'] = chat.kind === 'group' ? { channelId: String(chat._id) } : { userId: String(run.userId) };
  const posted = await postBotMessage(installation, { target, ...(response.text ? { text: response.text } : {}), ...(card ? { card } : {}), idempotencyKey: `schedule:${schedule.id}:${schedule.scheduledFor.toISOString()}` });
  if ('error' in posted) {
    await tell('la app ya no está en ese canal.');
    return record('failed', posted.message);
  }
  return record('posted');
}

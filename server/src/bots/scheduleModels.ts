import mongoose, { Schema, type Model, type Types } from 'mongoose';
import type { ScheduleOutcome, ScheduleRepeat } from '@lilachat/shared';

export type { ScheduleOutcome };


/**
 * A command that runs at a time and posts its report (José, 28/10; agentes
 * `specs/COMANDOS-Y-HORARIOS.spec.md` §3). Its own collection, not a reminder:
 * a reminder rings every member's phone and shows in the agenda, and a
 * schedule only posts what the app answers. The repetition is the reminders'
 * (`nextRepeat`) and it runs in the same cron tick.
 */
export type AppSchedule = {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  installationId: Types.ObjectId;
  appId: Types.ObjectId;
  /** A channel of the space, or the creator's 1:1 with the app. */
  chatId: Types.ObjectId;
  /** It runs AS this person: their account in the product, their permission in Lilachat. */
  createdBy: Types.ObjectId;
  command: string;
  text: string;
  time: string;
  repeat: ScheduleRepeat;
  onlyIfSomething: boolean;
  active: boolean;
  /** The next slot; the cron moves it forward before running, so two ticks never run one slot twice. */
  nextRunAt: Date;
  lastRun?: { scheduledFor: Date; at: Date; outcome: ScheduleOutcome; message?: string };
  createdAt: Date;
};

const scheduleSchema = new Schema<AppSchedule>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    installationId: { type: Schema.Types.ObjectId, required: true },
    appId: { type: Schema.Types.ObjectId, required: true },
    chatId: { type: Schema.Types.ObjectId, required: true },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    command: { type: String, required: true },
    text: { type: String, default: '' },
    time: { type: String, required: true },
    repeat: { type: Schema.Types.Mixed, required: true },
    onlyIfSomething: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    nextRunAt: { type: Date, required: true },
    lastRun: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
scheduleSchema.index({ active: 1, nextRunAt: 1 });
scheduleSchema.index({ installationId: 1, createdAt: 1 });

export const AppScheduleModel: Model<AppSchedule> = (mongoose.models.AppSchedule as Model<AppSchedule>) ?? mongoose.model<AppSchedule>('AppSchedule', scheduleSchema);

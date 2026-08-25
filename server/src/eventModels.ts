import mongoose, { Schema, type Model, type Types } from 'mongoose';
import type { Recurrence, Rsvp } from '@lilachat/shared';

/**
 * Eventos, recordatorios y encuestas (F5).
 *
 * Los tres cuelgan de un CHAT, no de un usuario suelto: en el diseño se crean
 * desde una conversación e invitan a sus miembros, y colgarlos del usuario
 * obligaría a re-implementar los permisos que el chat ya resuelve.
 */

export interface EventAttendee {
  userId: Types.ObjectId;
  rsvp?: Rsvp;
}

export interface ChatEvent {
  _id: Types.ObjectId;
  chatId: Types.ObjectId;
  title: string;
  description?: string;
  startsAt: Date;
  endsAt?: Date;
  location?: string;
  createdBy: Types.ObjectId;
  attendees: EventAttendee[];
  remindMinutesBefore: number;
  /** Sello del aviso ya emitido: sin él, el cron solapado repite el aviso. */
  remindedAt?: Date | null;
  guestsCanInvite: boolean;
}

export interface Reminder {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** Un recordatorio COMPARTIDO cuelga de un chat; el personal, de nadie más. */
  chatId?: Types.ObjectId;
  title: string;
  note?: string;
  startsAt: Date;
  recurrence: Recurrence;
  active: boolean;
  remindedAt?: Date | null;
}

export interface Poll {
  _id: Types.ObjectId;
  chatId: Types.ObjectId;
  question: string;
  options: { text: string; votes: Types.ObjectId[] }[];
  allowMultiple: boolean;
  anonymous: boolean;
  createdBy: Types.ObjectId;
  closedAt?: Date | null;
}

const eventSchema = new Schema<ChatEvent>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date },
    location: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    attendees: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        rsvp: { type: String, enum: ['yes', 'no', 'maybe'] },
      },
    ],
    remindMinutesBefore: { type: Number, default: 60 },
    remindedAt: { type: Date, default: null },
    guestsCanInvite: { type: Boolean, default: false },
  },
  { timestamps: true }
);
// El cron busca «los que empiezan pronto y no avisé»: sin este índice recorre
// la colección entera cada minuto.
eventSchema.index({ startsAt: 1, remindedAt: 1 });
eventSchema.index({ chatId: 1, startsAt: 1 });

const reminderSchema = new Schema<Reminder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat' },
    title: { type: String, required: true, trim: true },
    // La segunda línea de la tarjeta del diseño («Cada 2 horas», «Llamada
    // semanal»). Es lo que distingue dos recordatorios de título parecido.
    note: { type: String, trim: true },
    startsAt: { type: Date, required: true },
    recurrence: { type: String, enum: ['once', 'daily', 'weekly'], default: 'once' },
    active: { type: Boolean, default: true },
    remindedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
reminderSchema.index({ userId: 1, active: 1 });
reminderSchema.index({ active: 1, startsAt: 1 });

const pollSchema = new Schema<Poll>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
    question: { type: String, required: true, trim: true },
    options: [
      {
        text: { type: String, required: true, trim: true },
        votes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      },
    ],
    allowMultiple: { type: Boolean, default: false },
    anonymous: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
pollSchema.index({ chatId: 1, createdAt: -1 });

export const EventModel: Model<ChatEvent> =
  (mongoose.models.ChatEvent as Model<ChatEvent>) ??
  mongoose.model<ChatEvent>('ChatEvent', eventSchema);
export const ReminderModel: Model<Reminder> =
  (mongoose.models.Reminder as Model<Reminder>) ?? mongoose.model<Reminder>('Reminder', reminderSchema);
export const PollModel: Model<Poll> =
  (mongoose.models.Poll as Model<Poll>) ?? mongoose.model<Poll>('Poll', pollSchema);

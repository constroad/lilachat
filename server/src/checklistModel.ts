import mongoose, { Schema, type Model, type Types } from 'mongoose';

/**
 * A checklist in a chat, like Telegram's (José, 21/10; backlog 8). Its card is
 * a message with `ref {tipo: 'checklist'}`; the tasks and who ticked them live
 * here and change without touching the message (`ref.changed`).
 */
export interface ChecklistTask {
  /** Short id of its own: a task keeps it when others are added. */
  id: string;
  text: string;
  addedBy: Types.ObjectId;
  doneBy: Types.ObjectId | null;
  doneAt: Date | null;
  /** Who does it and for when (backlog 30). */
  assignee?: Types.ObjectId | null;
  dueAt?: Date | null;
}

export interface Checklist {
  _id: Types.ObjectId;
  chatId: Types.ObjectId;
  createdBy: Types.ObjectId;
  title: string;
  items: ChecklistTask[];
  othersCanMark: boolean;
  othersCanAdd: boolean;
  /** The seq of its card in the chat: the chat info and «Mis tareas» jump to it. */
  cardSeq?: number;
  createdAt: Date;
  updatedAt: Date;
}

const checklistSchema = new Schema<Checklist>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    items: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true, trim: true },
        addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        doneBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        doneAt: { type: Date, default: null },
        assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        dueAt: { type: Date, default: null },
        _id: false,
      },
    ],
    othersCanMark: { type: Boolean, default: true },
    othersCanAdd: { type: Boolean, default: true },
    cardSeq: { type: Number },
  },
  { timestamps: true }
);
checklistSchema.index({ chatId: 1, createdAt: -1 });
// «Mis tareas»: the tasks assigned to someone. Both indexes created in production with José's OK (21/10; the vault does not auto-index).
checklistSchema.index({ 'items.assignee': 1 });

export const ChecklistModel: Model<Checklist> = (mongoose.models.Checklist as Model<Checklist>) ?? mongoose.model<Checklist>('Checklist', checklistSchema);

import { Schema, model, type Types } from 'mongoose';

/** A space's own emoji (pending 19). The image is kept relative, like every media, and served absolute. */
export type CustomEmojiDoc = {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  url: string;
  mime: string;
  animated: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
};

const customEmojiSchema = new Schema<CustomEmojiDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    mime: { type: String, required: true },
    animated: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
// One name per space; the list reads by space. The vault has no autoIndex: created by hand with José's OK (scripts/bot-indexes.ts).
customEmojiSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export const CustomEmojiModel = model<CustomEmojiDoc>('CustomEmoji', customEmojiSchema, 'custom_emojis');

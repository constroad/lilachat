import mongoose, { Schema, type Model, type Types } from 'mongoose';

/**
 * A sticker in «Mis stickers» (José, 20/10): the ones I made from a photo, the
 * ones I saved from a chat and the pack ones I marked as favorite. The file is
 * a 512×512 transparent WebP or PNG uploaded once (pack ones live on the web
 * server); sending it to a chat reuses the same file.
 */
export interface Sticker {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** Storage name, or `pack:<pack>/<slug>` for a default pack sticker. */
  mediaId: string;
  url: string;
  mime: string;
  width: number;
  height: number;
  favorite: boolean;
  /** Made from a GIF (pending 37): an animated WebP. */
  animated?: boolean;
  createdAt: Date;
}

const stickerSchema = new Schema<Sticker>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    mediaId: { type: String, required: true },
    url: { type: String, required: true },
    mime: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    favorite: { type: Boolean, default: false },
    animated: { type: Boolean },
  },
  { versionKey: false, timestamps: { createdAt: true, updatedAt: false } }
);
// The vault DB has no autoIndex: these are created by hand with José's OK.
stickerSchema.index({ userId: 1, createdAt: -1 });
stickerSchema.index({ userId: 1, mediaId: 1 }, { unique: true });

export const StickerModel: Model<Sticker> =
  (mongoose.models.Sticker as Model<Sticker>) ?? mongoose.model<Sticker>('Sticker', stickerSchema, 'stickers');

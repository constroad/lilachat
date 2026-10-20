import mongoose, { Schema, type Model, type Types } from 'mongoose';

/**
 * Un mensaje destacado (José aprobó el 20/10): la estrella PERSONAL de
 * WhatsApp. Colección aparte y chica: la lista global se lee por usuario sin
 * recorrer los mensajes, y el texto se toma del mensaje (`{chatId, seq}`, que
 * tiene índice único) al mostrarla.
 */
export interface Destacado {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  chatId: Types.ObjectId;
  seq: number;
  en: Date;
}

const destacadoSchema = new Schema<Destacado>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    chatId: { type: Schema.Types.ObjectId, required: true },
    seq: { type: Number, required: true },
    en: { type: Date, required: true },
  },
  { versionKey: false }
);
// Declarados para crearlos en la bóveda con el OK de José (no hay autoIndex).
// Mientras tanto la idempotencia la da el upsert, no el índice.
destacadoSchema.index({ userId: 1, chatId: 1, seq: 1 }, { unique: true });
destacadoSchema.index({ userId: 1, en: -1 });

export const DestacadoModel: Model<Destacado> =
  (mongoose.models.Destacado as Model<Destacado>) ?? mongoose.model<Destacado>('Destacado', destacadoSchema, 'destacados');

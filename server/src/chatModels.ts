import mongoose, { Schema, type Model, type Types } from 'mongoose';

/**
 * Chats, mensajes y acuses (spec §7).
 *
 * Dos decisiones que ordenan el archivo:
 *
 * 1. **`seq` monotónico POR CHAT**, no un timestamp: el orden de una
 *    conversación no puede depender del reloj de un teléfono, y el cursor de
 *    sincronización necesita un número comparable.
 * 2. **Los acuses son un CURSOR, no una fila por mensaje**: «leí hasta el 42».
 *    Un documento por mensaje y por persona multiplica las escrituras por nada
 *    — lo que se pregunta siempre es «cuántos me faltan», que es una resta.
 */

export interface ChatMember {
  userId: Types.ObjectId;
  role: 'admin' | 'member';
  joinedAt?: Date;
}

export interface Chat {
  _id: Types.ObjectId;
  kind: 'direct' | 'group';
  name?: string;
  avatarMediaId?: string;
  members: ChatMember[];
  /** Último `seq` asignado. Es el contador que `$inc` mueve. */
  lastSeq: number;
}

export interface Message {
  _id: Types.ObjectId;
  chatId: Types.ObjectId;
  seq: number;
  senderId: Types.ObjectId;
  clientKey: string;
  kind: 'text' | 'image' | 'video' | 'file' | 'event' | 'system';
  body?: string;
  media?: { mediaId: string; thumbUrl?: string; url?: string; width?: number; height?: number; mime?: string };
  replyToSeq?: number;
  editedAt?: Date;
  deletedAt?: Date;
  at: Date;
}

export interface Receipt {
  chatId: Types.ObjectId;
  userId: Types.ObjectId;
  deliveredSeq: number;
  readSeq: number;
}

const chatSchema = new Schema<Chat>(
  {
    kind: { type: String, enum: ['direct', 'group'], required: true },
    name: { type: String },
    avatarMediaId: { type: String },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['admin', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    lastSeq: { type: Number, default: 0 },
  },
  { timestamps: true }
);
// «Mis chats» es LA consulta de la app: se hace una vez por arranque y por
// reconexión, así que va indexada por miembro.
chatSchema.index({ 'members.userId': 1 });

const messageSchema = new Schema<Message>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
    seq: { type: Number, required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clientKey: { type: String, required: true },
    kind: {
      type: String,
      enum: ['text', 'image', 'video', 'file', 'event', 'system'],
      default: 'text',
    },
    body: { type: String },
    media: {
      mediaId: String,
      thumbUrl: String,
      url: String,
      width: Number,
      height: Number,
      mime: String,
    },
    replyToSeq: { type: Number },
    editedAt: { type: Date },
    deletedAt: { type: Date },
    at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
// El orden de la conversación, y la garantía de que no haya dos con el mismo
// número aunque dos escrituras corran a la vez.
messageSchema.index({ chatId: 1, seq: 1 }, { unique: true });
// La idempotencia, en la BASE y no solo en el código: es la última línea de
// defensa contra el reintento de la cola offline. Lleva `senderId` porque dos
// personas pueden generar la misma clave sin saberlo.
messageSchema.index({ chatId: 1, senderId: 1, clientKey: 1 }, { unique: true });

const receiptSchema = new Schema<Receipt>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deliveredSeq: { type: Number, default: 0 },
    readSeq: { type: Number, default: 0 },
  },
  { timestamps: true }
);
receiptSchema.index({ chatId: 1, userId: 1 }, { unique: true });

export const ChatModel: Model<Chat> =
  (mongoose.models.Chat as Model<Chat>) ?? mongoose.model<Chat>('Chat', chatSchema);
export const MessageModel: Model<Message> =
  (mongoose.models.Message as Model<Message>) ?? mongoose.model<Message>('Message', messageSchema);
export const ReceiptModel: Model<Receipt> =
  (mongoose.models.Receipt as Model<Receipt>) ?? mongoose.model<Receipt>('Receipt', receiptSchema);

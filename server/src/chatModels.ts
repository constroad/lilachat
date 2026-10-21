import mongoose, { Schema, type Model, type Types } from 'mongoose';
import type { RefDeMensaje } from '@lilachat/shared';

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
  /** Silenciado por ESTE miembro: no recibe push de este chat. */
  muted?: boolean;
  /** E3b: with `muted`, «nada» means not even mentions ring (`notificationLevel`). */
  avisos?: 'nada';
  /** Fijado por ESTE miembro: va arriba de su lista. */
  pinned?: boolean;
  /** Archivado por ESTE miembro (FL9): vive en su «Archivados». */
  archived?: boolean;
  /** Marcado a mano como no leído (FL9); se va solo al leer. */
  markedUnread?: boolean;
  /**
   * «Eliminar chat» para este miembro (FL9d): no ve nada hasta este `seq`, y el
   * chat sale de su lista hasta que llegue uno nuevo.
   */
  borradoHasta?: number;
}

export interface Chat {
  _id: Types.ObjectId;
  /** `notas`: un borrador, un chat solo contigo y con nombre (19/10). */
  kind: 'direct' | 'group' | 'notas';
  name?: string;
  /** El nombre del archivo en el storage, para poder borrarlo algún día. */
  avatarMediaId?: string;
  /** La foto del grupo, RELATIVA (`/files/…`); el host lo pone el server. */
  avatarUrl?: string;
  /** La descripción del grupo (20/10): larga, con párrafos (`normalizarDescripcion`). */
  descripcion?: string;
  /** El chat contigo («Tú · Envíate un mensaje», 20/10): un borrador único por persona. */
  propio?: boolean;
  members: ChatMember[];
  /** Último `seq` asignado. Es el contador que `$inc` mueve. */
  lastSeq: number;
  /**
   * Chat secreto (F9): el server solo ve sobres.
   *
   * Es una propiedad del CHAT y no del mensaje porque tiene que decidirse una
   * vez, al crearlo: un chat que a veces cifra y a veces no le daría al usuario
   * una promesa que no puede sostener.
   */
  encrypted?: boolean;
  /** Mensajes fijados arriba del chat (19/10): hasta 3, cada uno con su vencimiento. */
  fijados?: { seq: number; por: Types.ObjectId; en: Date; hasta: Date }[];
}

/** El resumen de un hilo, guardado en su raíz (E3). */
export type ResumenDeHilo = { respuestas: number; ultimaEn?: Date; ultimaSeq?: number; autores?: string[] };

export interface Message {
  _id: Types.ObjectId;
  chatId: Types.ObjectId;
  seq: number;
  senderId: Types.ObjectId;
  clientKey: string;
  kind: 'text' | 'image' | 'video' | 'audio' | 'file' | 'event' | 'poll' | 'reminder' | 'system' | 'sticker';
  body?: string;
  /**
   * La encuesta o el evento que este mensaje publica en el chat (José, 18/10).
   * El mensaje lleva solo la referencia: los votos y las confirmaciones cambian
   * y se leen de la encuesta o del evento, no se copian acá.
   */
  ref?: RefDeMensaje;
  /**
   * El sobre cifrado, en los chats secretos. Cuando está, `body` NO está: son
   * excluyentes, y guardar los dos anularía el cifrado en la práctica.
   */
  envelope?: { v: number; nonce: string; ciphertext: string };
  media?: {
    mediaId: string;
    thumbUrl?: string;
    url?: string;
    width?: number;
    height?: number;
    /** La onda de una nota de voz (FL9): barras de 0 a 100. */
    onda?: number[];
    mime?: string;
    /**
     * El nombre ORIGINAL del archivo y su tamaño.
     *
     * Sin esto un PDF llegaba al chat como un rectángulo sin nombre: el
     * `mediaId` es el nombre en el storage (`file-2026-08-30T…pdf`), que no le
     * dice nada a nadie. Para fotos y videos no hace falta —se ven— pero un
     * documento ES su nombre.
     */
    fileName?: string;
    sizeBytes?: number;
    /** Duración de una nota de voz en ms. */
    durationMs?: number;
  };
  /**
   * El aviso de un cambio del grupo, en `kind: 'system'`.
   *
   * Se guarda el EVENTO y los ids, no la frase: el server solo conoce el nombre
   * que cada uno se puso, y el que quien mira reconoce es el de su agenda. La
   * frase la arma el teléfono (`textoDeAviso`). `body` lleva una versión con los
   * nombres del server, que es lo que se ve en la notificación y en la web.
   */
  system?: {
    evento: string;
    targetId?: string;
    valor?: string;
    /**
     * Quién y a quién, con lo que hace falta para que el TELÉFONO resuelva el
     * nombre contra su agenda. Se guardan al escribir el aviso, no se resuelven
     * al leerlo: es un hecho pasado —«el 30/08 Wilson agregó a Ana»— y una
     * consulta por mensaje al servir sería cara para algo que no cambia.
     */
    quien?: { phone?: string; name?: string };
    aQuien?: { phone?: string; name?: string };
  };
  replyToSeq?: number;
  /** Las @menciones del texto (José, 18/10), ya validadas (`validarMenciones`). */
  menciones?: { userId: string; desde: number; largo: number }[];
  /** E3 (20/10): es una respuesta en el hilo de este `seq` (la raíz). */
  hiloDe?: number;
  /** La respuesta del hilo se ve también en el chat («También enviar al chat»). */
  enElChat?: boolean;
  /** En la RAÍZ: cuántas respuestas, la última y los 3 últimos que respondieron. */
  hilo?: ResumenDeHilo;
  /** Reacciones (20/10): una por persona, en el orden en que llegaron. */
  reacciones?: { userId: string; emoji: string; en: Date }[];
  editedAt?: Date;
  /**
   * Cuándo se borró, si se borró (27/08/2026).
   *
   * El campo ya estaba declarado pero sin schema ni uso: era una intención, no
   * una función. Al implementarlo se decidió que el contenido **se va de
   * verdad** —`body`, `envelope` y `media` quedan vacíos—: una bandera que
   * conserva el texto es una mentira, porque el server guarda las
   * conversaciones en claro (§32 del as-is).
   *
   * El `seq`, el autor y la fecha SÍ se conservan: sostienen el orden y la
   * sincronización por cursor. Borrarlos dejaría huecos en la numeración que los
   * clientes leen como mensajes por descargar.
   */
  deletedAt?: Date;
  /** Es una auto-respuesta de ausente (F11): NO dispara otra (corta los loops). */
  autoReply?: boolean;
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
    kind: { type: String, enum: ['direct', 'group', 'notas'], required: true },
    name: { type: String },
    avatarMediaId: { type: String },
    avatarUrl: { type: String },
    descripcion: { type: String },
    propio: { type: Boolean },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['admin', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
        muted: { type: Boolean },
        avisos: { type: String, enum: ['nada'] },
        pinned: { type: Boolean },
        archived: { type: Boolean },
        markedUnread: { type: Boolean },
        borradoHasta: { type: Number },
      },
    ],
    lastSeq: { type: Number, default: 0 },
    encrypted: { type: Boolean, default: false },
    fijados: {
      type: [{ seq: { type: Number, required: true }, por: { type: Schema.Types.ObjectId, required: true }, en: { type: Date, required: true }, hasta: { type: Date, required: true }, _id: false }],
      default: undefined,
    },
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
      enum: ['text', 'image', 'video', 'audio', 'file', 'event', 'poll', 'reminder', 'system', 'sticker'],
      default: 'text',
    },
    body: { type: String },
    ref: {
      type: new Schema({ tipo: { type: String, enum: ['encuesta', 'evento', 'recordatorio'], required: true }, id: { type: String, required: true } }, { _id: false }),
    },
    envelope: {
      v: { type: Number },
      nonce: { type: String },
      ciphertext: { type: String },
    },
    system: {
      type: new Schema(
        {
          evento: { type: String, required: true },
          targetId: String,
          valor: String,
          quien: { type: new Schema({ phone: String, name: String }, { _id: false }) },
          aQuien: { type: new Schema({ phone: String, name: String }, { _id: false }) },
        },
        { _id: false }
      ),
    },
    media: {
      mediaId: String,
      thumbUrl: String,
      url: String,
      width: Number,
      height: Number,
      onda: { type: [Number], default: undefined },
      mime: String,
          fileName: String,
      sizeBytes: Number,
      durationMs: Number,
    },
    replyToSeq: { type: Number },
    menciones: {
      type: [new Schema({ userId: { type: String, required: true }, desde: { type: Number, required: true }, largo: { type: Number, required: true } }, { _id: false })],
      default: undefined,
    },
    hiloDe: { type: Number },
    enElChat: { type: Boolean },
    hilo: { type: new Schema({ respuestas: { type: Number, default: 0 }, ultimaEn: Date, ultimaSeq: Number, autores: { type: [String], default: undefined } }, { _id: false }) },
    reacciones: {
      type: [new Schema({ userId: { type: String, required: true }, emoji: { type: String, required: true }, en: { type: Date, required: true } }, { _id: false })],
      default: undefined,
    },
    editedAt: { type: Date },
    deletedAt: { type: Date },
    autoReply: { type: Boolean, default: false },
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

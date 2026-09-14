import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { ForbiddenChatError, sendMessage } from './chatService.js';

/**
 * Mensajes PROGRAMADOS (F11): se escriben ahora y se envían solos a una hora
 * futura — el saludo de cumpleaños a las 00:00 sin tener que acordarse.
 *
 * El envío real pasa por `sendMessage` (membresía, `seq`, idempotencia por
 * `clientKey`), igual que un mensaje normal: un programado no es un camino
 * paralelo, es el MISMO envío disparado por el reloj.
 */
export interface ScheduledMessage {
  chatId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  /** La clave del cliente, para que el envío sea idempotente si el tick reintenta. */
  clientKey: string;
  sendAt: Date;
  /** Cuándo se envió. `null` mientras está pendiente; también sirve de CANDADO
   *  para que dos ticks no lo manden dos veces. */
  sentAt?: Date | null;
  /** Cancelado antes de enviarse. Un cancelado no se envía ni se lista. */
  canceledAt?: Date | null;
}

const schema = new Schema<ScheduledMessage>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true },
    clientKey: { type: String, required: true },
    sendAt: { type: Date, required: true },
    sentAt: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
  },
  { timestamps: true }
);
// Para el tick: los que vencen y siguen pendientes.
schema.index({ sentAt: 1, canceledAt: 1, sendAt: 1 });
// Para listar los pendientes de una persona.
schema.index({ senderId: 1, sentAt: 1, canceledAt: 1 });

export const ScheduledMessageModel: Model<ScheduledMessage> =
  (mongoose.models.ScheduledMessage as Model<ScheduledMessage>) ??
  mongoose.model<ScheduledMessage>('ScheduledMessage', schema);

/** Un programado tiene que ser a FUTURO. Con `<= now` se enviaría de una, que es
 *  un mensaje normal disfrazado; y sin tope, «dentro de 5 años» llena la base. */
export function puedeProgramar(sendAt: Date, now: Date): boolean {
  const ms = sendAt.getTime() - now.getTime();
  const UN_ANIO = 365 * 24 * 3600 * 1000;
  return ms > 30_000 && ms <= UN_ANIO;
}

async function esMiembro(chatId: Types.ObjectId, userId: Types.ObjectId): Promise<boolean> {
  return (await ChatModel.exists({ _id: chatId, 'members.userId': userId })) !== null;
}

export type ProgramadoDTO = {
  id: string;
  chatId: string;
  body: string;
  sendAt: string;
};

export async function programarMensaje(params: {
  chatId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  sendAt: Date;
  clientKey: string;
}): Promise<ProgramadoDTO> {
  if (!(await esMiembro(params.chatId, params.senderId))) throw new ForbiddenChatError();

  const creado = await ScheduledMessageModel.create({
    chatId: params.chatId,
    senderId: params.senderId,
    body: params.body,
    clientKey: params.clientKey,
    sendAt: params.sendAt,
  });
  return {
    id: String(creado._id),
    chatId: String(creado.chatId),
    body: creado.body,
    sendAt: creado.sendAt.toISOString(),
  };
}

export async function pendientesDe(senderId: Types.ObjectId): Promise<ProgramadoDTO[]> {
  const filas = await ScheduledMessageModel.find({ senderId, sentAt: null, canceledAt: null })
    .sort({ sendAt: 1 })
    .lean<(ScheduledMessage & { _id: Types.ObjectId })[]>();
  return filas.map((fila) => ({
    id: String(fila._id),
    chatId: String(fila.chatId),
    body: fila.body,
    sendAt: fila.sendAt.toISOString(),
  }));
}

/** Cancelar SOLO si es mío y sigue pendiente. Devuelve si canceló algo. */
export async function cancelarProgramado(
  id: Types.ObjectId,
  senderId: Types.ObjectId
): Promise<boolean> {
  const r = await ScheduledMessageModel.updateOne(
    { _id: id, senderId, sentAt: null, canceledAt: null },
    { $set: { canceledAt: new Date() } }
  );
  return r.modifiedCount === 1;
}

const MAX_POR_TICK = 100;

/**
 * El tick del reloj: manda los programados que vencieron. Reusa el patrón del
 * cron de recordatorios — **candado antes de enviar**: se marca `sentAt` con un
 * `updateOne` condicional, y solo quien gana esa carrera envía. Sin eso, dos
 * ticks solapados mandarían el mismo mensaje dos veces.
 */
export async function runScheduledTick(now: Date = new Date()): Promise<{ enviados: number }> {
  let enviados = 0;
  const vencidos = await ScheduledMessageModel.find({
    sentAt: null,
    canceledAt: null,
    sendAt: { $lte: now },
  })
    .limit(MAX_POR_TICK)
    .lean<(ScheduledMessage & { _id: Types.ObjectId })[]>();

  for (const fila of vencidos) {
    const ganado = await ScheduledMessageModel.updateOne(
      { _id: fila._id, sentAt: null },
      { $set: { sentAt: now } }
    );
    if (ganado.modifiedCount === 0) continue;

    try {
      await sendMessage({
        chatId: String(fila.chatId),
        senderId: fila.senderId,
        clientKey: fila.clientKey,
        body: fila.body,
      });
      enviados += 1;
    } catch {
      // Si el envío falla (p. ej. lo sacaron del chat), el candado ya quedó
      // puesto: no se reintenta para siempre. El programado queda como «enviado»
      // aunque no se haya podido — es mejor que un bucle que lo intenta cada
      // minuto contra un chat al que ya no pertenece.
    }
  }
  return { enviados };
}

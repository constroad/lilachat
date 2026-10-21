import { Types } from 'mongoose';
import { actsAsMessage } from '@lilachat/shared';
import { ChatModel, MessageModel, type Message, type ResumenDeHilo } from './chatModels.js';

/** Cuántas respuestas trae de una vez el hilo abierto. */
const MAXIMO_DE_RESPUESTAS = 500;
/** Cuántos autores recientes guarda la raíz (los avatares del chip). */
const AUTORES_VISIBLES = 3;

/**
 * Hilos (E3, 20/10). Una respuesta es un mensaje MÁS del chat —mismo `seq`,
 * misma sincronización offline, misma cola, editar y borrar—, marcado con
 * `hiloDe` (el `seq` de la raíz). El chat principal la oculta (salvo
 * `enElChat`) y la raíz guarda su resumen. No hay hilos de hilos, de avisos ni
 * de lo borrado, ni en un chat secreto.
 */
export class HiloInvalidoError extends Error {
  constructor(motivo = 'Ese mensaje no admite respuestas en hilo.') {
    super(motivo);
  }
}

/** La raíz tiene que existir, estar viva y no ser ella misma una respuesta. Antes de gastar un `seq`. */
export async function validarRaiz(chatId: Types.ObjectId, raiz: number, conSobre: boolean): Promise<void> {
  if (conSobre) throw new HiloInvalidoError('En un chat secreto todavía no hay hilos.');
  if (!Number.isInteger(raiz) || raiz <= 0) throw new HiloInvalidoError();
  const root = await MessageModel.findOne({ chatId, seq: raiz }).select('kind system deletedAt hiloDe envelope').lean<Pick<Message, 'kind' | 'system' | 'deletedAt' | 'hiloDe' | 'envelope'> | null>();
  if (!root || root.deletedAt || root.hiloDe || !actsAsMessage(root) || root.envelope) throw new HiloInvalidoError();
}

/** Una respuesta más: cuenta, hora y autores recientes (sin repetir, el último al final). */
export async function anotarRespuesta(params: { chatId: Types.ObjectId; raiz: number; autor: string; en: Date; seq: number }): Promise<ResumenDeHilo | null> {
  const actualizada = await MessageModel.findOneAndUpdate(
    { chatId: params.chatId, seq: params.raiz },
    [
      {
        $set: {
          'hilo.respuestas': { $add: [{ $ifNull: ['$hilo.respuestas', 0] }, 1] },
          'hilo.ultimaEn': params.en,
          // El `seq` de la última: el cliente marca «nuevas» comparándolo con lo que vio.
          'hilo.ultimaSeq': { $max: [{ $ifNull: ['$hilo.ultimaSeq', 0] }, params.seq] },
          'hilo.autores': {
            $slice: [{ $concatArrays: [{ $filter: { input: { $ifNull: ['$hilo.autores', []] }, cond: { $ne: ['$$this', params.autor] } } }, [params.autor]] }, -AUTORES_VISIBLES],
          },
        },
      },
    ],
    { returnDocument: 'after', projection: { hilo: 1 }, updatePipeline: true }
  ).lean<{ hilo?: ResumenDeHilo } | null>();
  return actualizada?.hilo ?? null;
}

/** Se borró una respuesta: una menos (nunca negativo). */
export async function descontarRespuesta(chatId: Types.ObjectId, raiz: number): Promise<ResumenDeHilo | null> {
  const actualizada = await MessageModel.findOneAndUpdate(
    { chatId, seq: raiz },
    [{ $set: { 'hilo.respuestas': { $max: [0, { $subtract: [{ $ifNull: ['$hilo.respuestas', 0] }, 1] }] } } }],
    { returnDocument: 'after', projection: { hilo: 1 }, updatePipeline: true }
  ).lean<{ hilo?: ResumenDeHilo } | null>();
  return actualizada?.hilo ?? null;
}

/** El chat de un miembro, o `null` si no lo es. */
async function chatDelMiembro(chatId: string, userId: Types.ObjectId): Promise<Types.ObjectId | null> {
  if (!Types.ObjectId.isValid(chatId)) return null;
  const id = new Types.ObjectId(chatId);
  return (await ChatModel.exists({ _id: id, 'members.userId': userId })) ? id : null;
}

/** El resumen de cada raíz con respuestas: el chip al día aunque el teléfono estuviera desconectado. */
export async function resumenesDelChat(chatId: string, userId: Types.ObjectId): Promise<{ raiz: number; hilo: ResumenDeHilo }[] | null> {
  const id = await chatDelMiembro(chatId, userId);
  if (!id) return null;
  const raices = await MessageModel.find({ chatId: id, 'hilo.respuestas': { $gt: 0 } }).select('seq hilo').lean<{ seq: number; hilo: ResumenDeHilo }[]>();
  return raices.map((raiz) => ({ raiz: raiz.seq, hilo: raiz.hilo }));
}

/** La raíz y sus respuestas, en orden. `null` si no soy miembro o la raíz no existe. */
export async function hiloCompleto(chatId: string, raiz: number, userId: Types.ObjectId): Promise<{ raiz: Message; respuestas: Message[] } | null> {
  const id = await chatDelMiembro(chatId, userId);
  if (!id || !Number.isInteger(raiz)) return null;
  const [mensajeRaiz, respuestas] = await Promise.all([
    MessageModel.findOne({ chatId: id, seq: raiz }).lean<Message | null>(),
    MessageModel.find({ chatId: id, hiloDe: raiz }).sort({ seq: 1 }).limit(MAXIMO_DE_RESPUESTAS).lean<Message[]>(),
  ]);
  return mensajeRaiz ? { raiz: mensajeRaiz, respuestas } : null;
}

/**
 * A quién le suena una respuesta del hilo: a quien escribió la raíz, a quien
 * ya respondió y a los mencionados. Con «También enviar al chat», a todos.
 * Los demás la ven al abrir el hilo, sin que les suene el teléfono.
 */
export async function interesadosEnElHilo(chatId: Types.ObjectId, raiz: number): Promise<Set<string>> {
  const [mensajeRaiz, autores] = await Promise.all([
    MessageModel.findOne({ chatId, seq: raiz }).select('senderId').lean<{ senderId: Types.ObjectId } | null>(),
    MessageModel.distinct('senderId', { chatId, hiloDe: raiz }),
  ]);
  const interesados = new Set(autores.map(String));
  if (mensajeRaiz) interesados.add(String(mensajeRaiz.senderId));
  return interesados;
}

import { Router } from 'express';
import { Types } from 'mongoose';
import { ACTS_AS_MESSAGE_FILTER, ChatModel, MessageModel } from './chatModels.js';
import { DestacadoModel } from './destacadoModel.js';
import { chatVisible, infoDeChats, personasPorId } from './contextoDeChats.js';
import { asyncRoute, requireSession } from './requireSession.js';

/** Cuántos devuelve la lista global: la estrella es para lo importante, no un archivo. */
const MAXIMO_EN_LA_LISTA = 200;

const comoId = (valor: unknown) => (Types.ObjectId.isValid(String(valor)) ? new Types.ObjectId(String(valor)) : null);

/**
 * «Destacados» (José aprobó el 20/10): la estrella PERSONAL, como WhatsApp.
 * El fijado es para todos; esto lo ve solo quien lo marcó. Todavía no en los
 * chats secretos (el server no ve su texto para listarlo).
 */
export function buildDestacadosRouter(): Router {
  const router = Router();
  // Sesión por ruta, no `router.use`: montado en una ruta compartida, el candado global
  // también cerraría las rutas públicas que se montan después.

  /** Los `seq` destacados de un chat, para la estrella de cada burbuja. */
  router.get('/chats/:chatId/destacados', requireSession, asyncRoute(async (req, res) => {
    const yo = req.session!.userId;
    const chatId = comoId(req.params.chatId);
    if (!chatId || !(await ChatModel.exists({ _id: chatId, 'members.userId': yo }))) return res.status(404).json({ message: 'Ese chat no existe.' });
    const filas = await DestacadoModel.find({ userId: yo, chatId }).select('seq').sort({ seq: 1 }).lean();
    res.json({ seqs: [...new Set(filas.map((fila) => fila.seq))] });
  }));

  router.put('/chats/:chatId/destacados/:seq', requireSession, asyncRoute(async (req, res) => {
    const yo = req.session!.userId;
    const chatId = comoId(req.params.chatId);
    const seq = Number(req.params.seq);
    const chat = chatId ? await ChatModel.findOne({ _id: chatId, 'members.userId': yo }).select('encrypted').lean() : null;
    if (!chat) return res.status(404).json({ message: 'Ese chat no existe.' });
    if (chat.encrypted) return res.status(400).json({ message: 'En un chat secreto todavía no se destaca.' });
    const allowed = Number.isInteger(seq) && (await MessageModel.exists({ chatId, seq, ...ACTS_AS_MESSAGE_FILTER, deletedAt: { $exists: false } }));
    if (!allowed) return res.status(400).json({ message: 'Ese mensaje no se puede destacar.' });
    await DestacadoModel.updateOne({ userId: yo, chatId, seq }, { $setOnInsert: { en: new Date() } }, { upsert: true });
    res.status(204).end();
  }));

  router.delete('/chats/:chatId/destacados/:seq', requireSession, asyncRoute(async (req, res) => {
    const chatId = comoId(req.params.chatId);
    if (chatId) await DestacadoModel.deleteMany({ userId: req.session!.userId, chatId, seq: Number(req.params.seq) });
    res.status(204).end();
  }));

  /** Todos los míos, del más reciente: el mensaje, quién lo escribió y en qué chat. */
  router.get('/destacados', requireSession, asyncRoute(async (req, res) => {
    const yo = req.session!.userId;
    const filas = await DestacadoModel.find({ userId: yo }).sort({ en: -1 }).limit(MAXIMO_EN_LA_LISTA).lean();
    const chatIds = [...new Set(filas.map((fila) => String(fila.chatId)))].map((id) => new Types.ObjectId(id));
    const sigoEn = new Set((await ChatModel.find({ _id: { $in: chatIds }, 'members.userId': yo }).select('_id').lean()).map((chat) => String(chat._id)));
    const vigentes = filas.filter((fila) => sigoEn.has(String(fila.chatId)));
    const mensajes = vigentes.length
      ? await MessageModel.find({ $or: vigentes.map((fila) => ({ chatId: fila.chatId, seq: fila.seq })), deletedAt: { $exists: false } })
          .select('chatId seq senderId kind body ref media.mime media.thumbUrl media.fileName at')
          .lean()
      : [];
    const porClave = new Map(mensajes.map((mensaje) => [`${mensaje.chatId}:${mensaje.seq}`, mensaje]));
    const chats = await infoDeChats([...sigoEn].map((id) => new Types.ObjectId(id)), String(yo));
    const personas = await personasPorId([...mensajes.map((mensaje) => String(mensaje.senderId)), ...[...chats.values()].flatMap((chat) => (chat.otroId ? [chat.otroId] : []))]);
    const destacados = vigentes.flatMap((fila) => {
      const mensaje = porClave.get(`${fila.chatId}:${fila.seq}`);
      if (!mensaje) return [];
      const autor = String(mensaje.senderId);
      return [{
        chatId: String(fila.chatId),
        seq: fila.seq,
        en: fila.en,
        chat: chatVisible(chats.get(String(fila.chatId)), personas),
        autor: { id: autor, ...personas.get(autor) },
        mensaje: { kind: mensaje.kind, at: mensaje.at, ...(mensaje.body ? { body: mensaje.body } : {}), ...(mensaje.ref ? { ref: mensaje.ref } : {}), ...(mensaje.media ? { media: mensaje.media } : {}) },
      }];
    });
    res.json({ destacados });
  }));

  return router;
}

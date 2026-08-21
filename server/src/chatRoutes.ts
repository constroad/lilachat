import { Router } from 'express';
import { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { DeviceModel } from './models.js';
import { ForbiddenChatError, listChats, listMessages, markRead } from './chatService.js';
import { toClientMessages } from './messageView.js';
import { requireSession } from './requireSession.js';

/**
 * REST de chats: el arranque de la app (lista e historial). El tiempo real va
 * por el socket, pero el historial paginado no: pedirle 50 mensajes viejos a un
 * socket es peor que un GET que se cachea y se reintenta solo.
 */
export function buildChatRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', async (req, res) => {
    res.json({ chats: await listChats(req.session!.userId) });
  });

  router.post('/', async (req, res) => {
    const kind = req.body?.kind === 'group' ? 'group' : 'direct';
    const rawMembers = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
    const memberIds = rawMembers
      .map((value: unknown) => String(value))
      .filter((value: string) => Types.ObjectId.isValid(value))
      .map((value: string) => new Types.ObjectId(value));

    // El creador SIEMPRE va adentro, aunque no se haya incluido: un chat sin su
    // autor es un chat que nadie puede abrir.
    const me = req.session!.userId;
    const unique = new Map<string, Types.ObjectId>([[String(me), me]]);
    for (const id of memberIds) unique.set(String(id), id);
    if (unique.size < 2) {
      return res.status(400).json({ message: 'Elige con quién quieres hablar.' });
    }

    const chat = await ChatModel.create({
      kind,
      name: typeof req.body?.name === 'string' ? req.body.name.trim() : undefined,
      members: [...unique.values()].map((userId) => ({
        userId,
        role: String(userId) === String(me) ? 'admin' : 'member',
      })),
      lastSeq: 0,
    });
    res.status(201).json({ chatId: String(chat._id) });
  });

  router.get('/:chatId/messages', async (req, res) => {
    try {
      const beforeSeq = Number(req.query.beforeSeq);
      const messages = await listMessages({
        chatId: String(req.params.chatId),
        userId: req.session!.userId,
        limit: Number(req.query.limit) || undefined,
        beforeSeq: Number.isFinite(beforeSeq) && beforeSeq > 0 ? beforeSeq : undefined,
      });
      res.json({ messages: toClientMessages(messages) });
    } catch (error) {
      if (error instanceof ForbiddenChatError) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  });

  router.post('/:chatId/read', async (req, res) => {
    const seq = Number(req.body?.seq);
    if (!Number.isFinite(seq) || seq < 0) {
      return res.status(400).json({ message: 'Falta hasta dónde leíste.' });
    }
    try {
      await markRead({ chatId: String(req.params.chatId), userId: req.session!.userId, seq });
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof ForbiddenChatError) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  });

  /**
   * El token de push del teléfono. Va contra el DEVICE de la sesión, no contra
   * el usuario: cada aparato tiene el suyo, y notificar al token de un teléfono
   * que se cambió de dueño es peor que no notificar.
   */
  router.post('/push-token', async (req, res) => {
    const pushToken = String(req.body?.pushToken ?? '').trim();
    if (!pushToken) return res.status(400).json({ message: 'Falta el token.' });
    await DeviceModel.updateOne(
      { deviceId: req.session!.deviceId },
      { $set: { pushToken, platform: 'android' } }
    );
    res.json({ ok: true });
  });

  return router;
}

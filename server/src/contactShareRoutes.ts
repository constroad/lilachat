import { Router } from 'express';
import { Types } from 'mongoose';
import { cleanSharedContact, sharedContactBody } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { toClientMessage } from './messageView.js';
import { UserModel } from './models.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { notifyThread, publicarMensaje } from './socket.js';

const asObjectId = (value: unknown) => (Types.ObjectId.isValid(String(value)) ? new Types.ObjectId(String(value)) : null);

/**
 * Sharing a contact in the chat (pending 9, José 20/10), like WhatsApp. The
 * phone is matched with Lilachat's identity (the Peruvian number): when it is
 * someone's, the card offers «Enviar mensaje». Not in a secret chat: its
 * messages go sealed and this one would not.
 */
export function buildContactShareRouter(): Router {
  const router = Router();
  router.post('/:chatId/contacts', requireSession, asyncRoute(async (req, res) => {
    const me = req.session!.userId;
    const chatId = asObjectId(req.params.chatId);
    const chat = chatId ? await ChatModel.findOne({ _id: chatId, 'members.userId': me }).select('encrypted').lean() : null;
    if (!chat) return void res.status(404).json({ message: 'Ese chat no existe.' });
    if (chat.encrypted) return void res.status(400).json({ message: 'En un chat secreto todavía no se comparten contactos.' });
    const clientKey = String(req.body?.clientKey ?? '');
    if (!clientKey) return void res.status(400).json({ message: 'Falta la clave del envío.' });
    const cleaned = cleanSharedContact({ name: req.body?.name, phone: req.body?.phone });
    if (!cleaned.ok) return void res.status(400).json({ message: cleaned.message });
    const user = cleaned.local ? await UserModel.findOne({ phone: cleaned.local }).select('_id').lean() : null;
    const thread = Number.isInteger(req.body?.hiloDe) ? { hiloDe: req.body.hiloDe as number, enElChat: req.body?.enElChat === true } : {};
    const sent = await sendMessage({
      chatId: String(chatId),
      senderId: me,
      clientKey,
      kind: 'contact',
      body: sharedContactBody(cleaned.name),
      contact: { name: cleaned.name, phone: cleaned.phone, ...(user ? { userId: user._id } : {}) },
      ...(Number.isInteger(req.body?.replyToSeq) ? { replyToSeq: req.body.replyToSeq as number } : {}),
      ...thread,
    });
    if (!sent.duplicate) {
      const members = await publicarMensaje(sent.message, sent.members);
      if (sent.hilo && sent.message.hiloDe !== undefined) notifyThread(String(chatId), sent.message.hiloDe, sent.hilo, members);
    }
    res.status(201).json({ message: toClientMessage(sent.message), duplicate: sent.duplicate });
  }));
  return router;
}

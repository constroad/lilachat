import { Router } from 'express';
import { Types } from 'mongoose';
import { cleanSharedLocation, SHARED_LOCATION_BODY } from '@lilachat/shared';
import { liveMinutesOf, liveState, liveUntilFrom } from '@lilachat/shared';
import { ChatModel, MessageModel, type Message } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { toClientMessage } from './messageView.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { notifyThread, publicarMensaje } from './socket.js';
import { notifyEdited } from './reparto.js';

const asObjectId = (value: unknown) => (Types.ObjectId.isValid(String(value)) ? new Types.ObjectId(String(value)) : null);

/**
 * Sharing where I am in the chat (pending 11), like WhatsApp: the point the
 * phone gave and its accuracy. Not in a secret chat: its messages go sealed
 * and this one would not.
 */
export function buildLocationShareRouter(): Router {
  const router = Router();
  router.post('/:chatId/locations', requireSession, asyncRoute(async (req, res) => {
    const me = req.session!.userId;
    const chatId = asObjectId(req.params.chatId);
    const chat = chatId ? await ChatModel.findOne({ _id: chatId, 'members.userId': me }).select('encrypted').lean() : null;
    if (!chat) return void res.status(404).json({ message: 'Ese chat no existe.' });
    if (chat.encrypted) return void res.status(400).json({ message: 'En un chat secreto todavía no se comparte la ubicación.' });
    const clientKey = String(req.body?.clientKey ?? '');
    if (!clientKey) return void res.status(400).json({ message: 'Falta la clave del envío.' });
    const cleaned = cleanSharedLocation({ lat: req.body?.lat, lng: req.body?.lng, accuracy: req.body?.accuracy });
    if (!cleaned.ok) return void res.status(400).json({ message: cleaned.message });
    const liveMinutes = req.body?.liveMinutes === undefined || req.body?.liveMinutes === null ? null : liveMinutesOf(req.body.liveMinutes);
    if (req.body?.liveMinutes !== undefined && req.body?.liveMinutes !== null && !liveMinutes) return void res.status(400).json({ message: 'En tiempo real se comparte 15 minutos, 1 hora u 8 horas.' });
    const now = new Date();
    const thread = Number.isInteger(req.body?.hiloDe) ? { hiloDe: req.body.hiloDe as number, enElChat: req.body?.enElChat === true } : {};
    const sent = await sendMessage({
      chatId: String(chatId),
      senderId: me,
      clientKey,
      kind: 'location',
      body: SHARED_LOCATION_BODY,
      location: liveMinutes ? { ...cleaned.location, liveUntil: liveUntilFrom(liveMinutes, now), updatedAt: now } : cleaned.location,
      ...(Number.isInteger(req.body?.replyToSeq) ? { replyToSeq: req.body.replyToSeq as number } : {}),
      ...thread,
    });
    if (!sent.duplicate) {
      const members = await publicarMensaje(sent.message, sent.members);
      if (sent.hilo && sent.message.hiloDe !== undefined) notifyThread(String(chatId), sent.message.hiloDe, sent.hilo, members);
    }
    res.status(201).json({ message: toClientMessage(sent.message), duplicate: sent.duplicate });
  }));

  /** A new fix of a live location, from its author's phone; 410 once it ended, so the phone stops. */
  router.put('/:chatId/locations/:seq', requireSession, asyncRoute(async (req, res) => {
    const live = await ownLiveLocation(req.params.chatId!, req.params.seq!, req.session!.userId);
    if ('status' in live) return void res.status(live.status).json({ message: live.message });
    const cleaned = cleanSharedLocation({ lat: req.body?.lat, lng: req.body?.lng, accuracy: req.body?.accuracy });
    if (!cleaned.ok) return void res.status(400).json({ message: cleaned.message });
    const location = { ...live.message.location!, ...cleaned.location, updatedAt: new Date() };
    if (!cleaned.location.accuracy) delete location.accuracy;
    await MessageModel.updateOne({ _id: live.message._id }, { $set: { location } });
    announce(live.message, location, live.members);
    res.json({ location });
  }));

  /** «Dejar de compartir»: the card says it ended and the phone stops. */
  router.post('/:chatId/locations/:seq/stop', requireSession, asyncRoute(async (req, res) => {
    const live = await ownLiveLocation(req.params.chatId!, req.params.seq!, req.session!.userId);
    if ('status' in live) return void res.status(live.status === 410 ? 200 : live.status).json(live.status === 410 ? { ended: true } : { message: live.message });
    const location = { ...live.message.location!, endedAt: new Date() };
    await MessageModel.updateOne({ _id: live.message._id }, { $set: { location } });
    announce(live.message, location, live.members);
    res.json({ ended: true });
  }));
  return router;
}

type LiveLookup = { message: Message & { _id: Types.ObjectId }; members: string[] } | { status: 400 | 403 | 404 | 410; message: string };

/** The live location of `seq` if I sent it and it still lasts; otherwise why not. */
async function ownLiveLocation(chatIdRaw: string, seqRaw: string, me: Types.ObjectId): Promise<LiveLookup> {
  const chatId = asObjectId(chatIdRaw);
  const seq = Number(seqRaw);
  if (!chatId || !Number.isInteger(seq)) return { status: 404, message: 'Esa ubicación ya no está.' };
  const chat = await ChatModel.findOne({ _id: chatId, 'members.userId': me }).select('members.userId').lean();
  if (!chat) return { status: 404, message: 'Ese chat no existe.' };
  const message = await MessageModel.findOne({ chatId, seq, kind: 'location', deletedAt: { $exists: false } }).lean<(Message & { _id: Types.ObjectId }) | null>();
  if (!message?.location) return { status: 404, message: 'Esa ubicación ya no está.' };
  if (String(message.senderId) !== String(me)) return { status: 403, message: 'Solo quien la comparte la mueve.' };
  const state = liveState({ liveUntil: message.location.liveUntil?.toISOString(), endedAt: message.location.endedAt?.toISOString() }, new Date());
  if (state !== 'live') return { status: 410, message: 'Ya no se comparte en tiempo real.' };
  return { message, members: chat.members.map((member) => String(member.userId)) };
}

/** The members see the card move or end, like an edit, without a push. */
function announce(message: Message, location: NonNullable<Message['location']>, members: string[]): void {
  notifyEdited(members, { chatId: String(message.chatId), seq: message.seq, body: message.body ?? SHARED_LOCATION_BODY, location });
}

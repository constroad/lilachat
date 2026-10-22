import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { Types } from 'mongoose';
import { callLinkUrl } from '@lilachat/shared';
import { asyncRoute, requireSession } from './requireSession.js';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { resolveJwtSecret } from './sessions.js';

export const ONLY_DIRECT_CALLS = 'Las llamadas son solo en chats de dos personas.';
const INVALID_LINK = 'Este enlace de llamada no es válido.';
const NOT_A_MEMBER = 'Este enlace es de una conversación en la que no estás.';

/** Characters of the signature kept in the link: short to share, far too many to guess. */
const SIGNATURE_LENGTH = 22;

type CallLink = { chatId: string; video: boolean };

const signatureOf = (link: CallLink, secret: string): string =>
  createHmac('sha256', secret).update(`call-link:${link.chatId}:${link.video ? 'v' : 'a'}`).digest('base64url').slice(0, SIGNATURE_LENGTH);

/**
 * A call link (pending 42, José 22/10), like WhatsApp: `<chat>-<v|a>-<signature>`.
 * Signed and not stored, so it needs no collection: it opens only for the
 * chat's members, and a changed character breaks the signature.
 */
export function signCallLink(link: CallLink, secret: string): string {
  return `${link.chatId}-${link.video ? 'v' : 'a'}-${signatureOf(link, secret)}`;
}

export function readCallLink(token: string, secret: string): CallLink | null {
  const match = /^([0-9a-f]{24})-([va])-([A-Za-z0-9_-]+)$/.exec(token);
  if (!match) return null;
  const link = { chatId: match[1]!, video: match[2] === 'v' };
  const expected = Buffer.from(signatureOf(link, secret));
  const given = Buffer.from(match[3]!);
  return expected.length === given.length && timingSafeEqual(expected, given) ? link : null;
}

/** The other person's name, as the server knows it, for «¿Llamar a …?». */
async function otherNameOf(chat: { members: { userId: Types.ObjectId }[] }, me: string): Promise<string | null> {
  const other = chat.members.find((member) => String(member.userId) !== me);
  const user = other ? await UserModel.findById(other.userId).select('name phone').lean() : null;
  return user?.name ?? user?.phone ?? null;
}

export function buildCallLinksRouter(): Router {
  // Mounted on `/api`: the session goes on each route, never `router.use`,
  // or every later `/api` route (the sign-in among them) would ask for one.
  const router = Router();

  router.post('/chats/:chatId/call-link', requireSession, asyncRoute(async (req, res) => {
    const me = String(req.session!.userId);
    const chatId = req.params.chatId ?? '';
    const chat = Types.ObjectId.isValid(chatId) ? await ChatModel.findById(chatId).select('kind members.userId').lean() : null;
    if (!chat || !chat.members.some((member) => String(member.userId) === me)) return res.status(403).json({ message: NOT_A_MEMBER });
    if (chat.kind !== 'direct') return res.status(400).json({ message: ONLY_DIRECT_CALLS });
    const token = signCallLink({ chatId, video: req.body?.video === true }, resolveJwtSecret());
    res.status(201).json({ url: callLinkUrl(token) });
  }));

  router.get('/call-links/:token', requireSession, asyncRoute(async (req, res) => {
    const me = String(req.session!.userId);
    const link = readCallLink(req.params.token ?? '', resolveJwtSecret());
    const chat = link ? await ChatModel.findById(link.chatId).select('kind members.userId').lean() : null;
    if (!link || !chat) return res.status(404).json({ message: INVALID_LINK });
    if (!chat.members.some((member) => String(member.userId) === me)) return res.status(403).json({ message: NOT_A_MEMBER });
    res.json({ chatId: link.chatId, video: link.video, name: await otherNameOf(chat, me) });
  }));

  return router;
}

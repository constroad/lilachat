import { Router } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import { MAX_BYTES_BY_KIND, isPortalUploadTicket } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { requireSession } from './requireSession.js';
import { stampAskedOf } from './bots/stampAsked.js';
import { stampedChatMedia, type ChatFile } from './chatMediaStamp.js';

export type ForwardFetch = (url: string, form: FormData) => Promise<{ status: number; json: unknown }>;
type ForwardInput = { userId: Types.ObjectId; body: Record<string, unknown>; file: { buffer: Buffer; mimetype: string; originalname: string } };
type ForwardReply = { status: number; json: unknown };

/** Portal answers a 3-minute video in well under this; the phone's own upload had its minute already. */
const FORWARD_TIMEOUT_MS = 120_000;
const FIELDS_MAX_CHARS = 2000;
const refuse = (status: number, message: string): ForwardReply => ({ status, json: { message } });

const fetchForward: ForwardFetch = async (url, form) => {
  const response = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS) });
  return { status: response.status, json: await response.json().catch(() => ({})) };
};

/** The ticket's own fields, as agentes gave them to the phone: short strings only. */
function ticketFieldsOf(raw: unknown): Record<string, string> | null {
  if (typeof raw !== 'string' || raw.length > FIELDS_MAX_CHARS) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed);
    return entries.every(([, value]) => typeof value === 'string') ? Object.fromEntries(entries as [string, string][]) : null;
  } catch {
    return null;
  }
}

const kindOf = (mime: string): 'image' | 'video' | null => (mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : null);

/**
 * A shot of the new camera on its way to a Portal upload ticket (José 12/11; observations, «Registrar
 * avance», the Drive tab). The phone sends it once to us; we burn the stamp while compressing it and
 * forward it server to server. Only to a Portal upload ticket, and only for a chat the person is in.
 */
export async function forwardStamped(input: ForwardInput, fetcher: ForwardFetch = fetchForward): Promise<ForwardReply> {
  const { body, file, userId } = input;
  const fields = ticketFieldsOf(body.fields);
  const fileField = typeof body.fileField === 'string' ? body.fileField.slice(0, 64) : '';
  if (!isPortalUploadTicket(body.target) || !fields || !fileField) return refuse(400, 'Ese destino no es una subida del Portal.');
  const chatId = String(body.chatId ?? '');
  const member = Types.ObjectId.isValid(chatId) && (await ChatModel.exists({ _id: chatId, 'members.userId': userId }));
  if (!member) return refuse(403, 'No estás en ese chat.');
  const kind = kindOf(file.mimetype);
  if (!kind) return refuse(415, 'Solo se sellan fotos y videos.');
  const original: ChatFile = { bytes: file.buffer, mimeType: file.mimetype, fileName: file.originalname };
  const asked = stampAskedOf(body);
  const content = (asked?.timemark ? await stampedChatMedia(original, kind, asked, chatId) : null) ?? original;
  const form = new FormData();
  Object.entries(fields).forEach(([name, value]) => form.append(name, value));
  if (typeof body.clientUploadId === 'string') form.append('clientUploadId', body.clientUploadId.slice(0, 64));
  form.append(fileField, new Blob([new Uint8Array(content.bytes)], { type: content.mimeType }), content.fileName);
  return fetcher(body.target, form);
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES_BY_KIND.video } });

/** `POST /api/stamped-forward`: the phone's one upload of a stamped shot bound for Portal. */
export function buildStampedForwardRouter(): Router {
  const router = Router();
  router.post('/', requireSession, upload.single('file'), async (req, res) => {
    if (!req.file) return void res.status(400).json({ message: 'Falta el archivo.' });
    try {
      const reply = await forwardStamped({ userId: new Types.ObjectId(String(req.session!.userId)), body: req.body ?? {}, file: req.file });
      res.status(reply.status).json(reply.json);
    } catch (error) {
      console.error('[stamped-forward] no se pudo reenviar:', error instanceof Error ? error.message : error);
      res.status(503).json({ message: 'No se pudo subir ahora. Inténtalo de nuevo.' });
    }
  });
  return router;
}

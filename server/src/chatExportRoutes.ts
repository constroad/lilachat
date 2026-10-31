import { Router } from 'express';
import { Types } from 'mongoose';
import { DEFAULT_EXPORT_TIME_ZONE, exportChatText, exportFileName, isTimeZone, type ExportRow } from '@lilachat/shared';
import { ChatModel, MessageModel } from './chatModels.js';
import { UserModel } from './models.js';
import { asyncRoute, requireSession } from './requireSession.js';

/** WhatsApp's own limit for a file without media. */
const EXPORT_LIMIT = 40_000;

const asObjectId = (value: unknown) => (Types.ObjectId.isValid(String(value)) ? new Types.ObjectId(String(value)) : null);

/** The chat's name as its reader sees it: a 1:1 is called by the other person. */
function chatNameFor(chat: { kind: string; name?: string }, me: string, names: Map<string, string>, memberIds: string[]): string {
  if (chat.kind !== 'direct') return chat.name ?? 'Grupo';
  const other = memberIds.find((id) => id !== me);
  return (other && names.get(other)) || 'Conversación';
}

/**
 * «Exportar chat» (R31/10-B7): `GET /api/chats/:chatId/export?tz=America/Lima`
 * gives a `.txt` like WhatsApp's, for a member only. What they emptied «for
 * me» is not in it; a secret chat cannot be read by the server, so it is refused.
 */
export function buildChatExportRouter(): Router {
  const router = Router();
  router.get('/:chatId/export', requireSession, asyncRoute(async (req, res) => {
    const me = String(req.session!.userId);
    const chatId = asObjectId(req.params.chatId);
    const chat = chatId ? await ChatModel.findOne({ _id: chatId, 'members.userId': me }).select('kind name encrypted members.userId members.borradoHasta').lean() : null;
    if (!chat) return void res.status(404).json({ message: 'Ese chat no existe.' });
    if (chat.encrypted) return void res.status(409).json({ message: 'Un chat secreto no se puede exportar: el servidor no puede leerlo.' });
    const floor = chat.members.find((member) => String(member.userId) === me)?.borradoHasta ?? 0;
    const rows = await MessageModel.find({ chatId: chat._id, seq: { $gt: floor } })
      .sort({ seq: 1 })
      .limit(EXPORT_LIMIT)
      .select('senderId kind body media.name system at deletedAt disappearsAt hiloDe')
      .lean<(ExportRow & { senderId: Types.ObjectId })[]>();
    const memberIds = chat.members.map((member) => String(member.userId));
    const people = await UserModel.find({ _id: { $in: [...new Set([...memberIds, ...rows.map((row) => String(row.senderId))])] } }).select('name phone').lean();
    const names = new Map(people.map((person) => [String(person._id), person.name ?? person.phone ?? 'Alguien']));
    const tz = typeof req.query.tz === 'string' && isTimeZone(req.query.tz) ? req.query.tz : DEFAULT_EXPORT_TIME_ZONE;
    const text = exportChatText(rows.map((row) => ({ ...row, senderId: String(row.senderId) })), (id) => names.get(id) ?? 'Alguien', tz);
    const fileName = exportFileName(chatNameFor(chat, me, names, memberIds));
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="chat.txt"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(text);
  }));
  return router;
}

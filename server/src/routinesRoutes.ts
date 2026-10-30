import { Router } from 'express';
import { Types } from 'mongoose';
import { contactNoteOf, quietHoursOf } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { asyncRoute, requireSession } from './requireSession.js';

type Patch = { $set: Record<string, unknown>; $unset: Record<string, ''> };
type Outcome = { ok: true; patch: Patch } | { ok: false; reason: string };

/** What a PUT changes: each field set, or cleared with `null`; anything invalid refuses the whole request. */
function patchOf(body: unknown, isDirect: boolean): Outcome {
  const input = (body ?? {}) as { quietHours?: unknown; contactNote?: unknown };
  const patch: Patch = { $set: {}, $unset: {} };
  if ('quietHours' in input) {
    if (input.quietHours === null) patch.$unset['members.$.quietHours'] = '';
    else {
      const quiet = quietHoursOf(input.quietHours);
      if (!quiet) return { ok: false, reason: 'Elige al menos un día y dos horas distintas.' };
      patch.$set['members.$.quietHours'] = quiet;
    }
  }
  if ('contactNote' in input) {
    if (!isDirect) return { ok: false, reason: 'La nota es para un chat con una persona.' };
    if (input.contactNote === null) patch.$unset['members.$.contactNote'] = '';
    else {
      const note = contactNoteOf(input.contactNote);
      if (!note) return { ok: false, reason: 'Escribe la nota (hasta 200 letras).' };
      patch.$set['members.$.contactNote'] = note;
    }
  }
  if (Object.keys(patch.$set).length + Object.keys(patch.$unset).length === 0) return { ok: false, reason: 'No hay nada que cambiar.' };
  return { ok: true, patch };
}

type MyRoutine = { chatId: string; kind: string; name: string; quietHours?: unknown; contactNote?: unknown };

/** My routines across my chats, named as my list names them: the group, or the other person in a 1:1. */
async function myRoutines(me: Types.ObjectId): Promise<MyRoutine[]> {
  const chats = await ChatModel.find({ members: { $elemMatch: { userId: me, $or: [{ quietHours: { $exists: true } }, { contactNote: { $exists: true } }] } } })
    .select('kind name members.userId members.quietHours members.contactNote')
    .lean();
  const otherIds = chats.filter((chat) => chat.kind === 'direct').map((chat) => chat.members.find((member) => !member.userId.equals(me))?.userId).filter((id): id is Types.ObjectId => Boolean(id));
  const people = otherIds.length ? await UserModel.find({ _id: { $in: otherIds } }).select('name phone').lean() : [];
  const nameById = new Map(people.map((person) => [String(person._id), person.name ?? person.phone]));
  return chats.map((chat) => {
    const mine = chat.members.find((member) => member.userId.equals(me));
    const other = chat.members.find((member) => !member.userId.equals(me));
    const name = chat.kind === 'direct' ? (nameById.get(String(other?.userId)) ?? '') : (chat.name ?? 'Grupo');
    return { chatId: String(chat._id), kind: chat.kind, name, ...(mine?.quietHours ? { quietHours: mine.quietHours } : {}), ...(mine?.contactNote ? { contactNote: mine.contactNote } : {}) };
  });
}

/**
 * Automatizaciones (pending 17, design `automatizaciones`). The design's
 * location trigger is not built: following the phone's place costs battery
 * all day, and spec F11 asks to weigh that before promising it.
 */
export function buildRoutinesRouter(): Router {
  const router = Router();
  router.get('/routines', requireSession, asyncRoute(async (req, res) => {
    res.json({ routines: await myRoutines(new Types.ObjectId(req.session!.userId)) });
  }));
  router.put('/chats/:chatId/routines', requireSession, asyncRoute(async (req, res) => {
    const me = new Types.ObjectId(req.session!.userId);
    const chat = Types.ObjectId.isValid(String(req.params.chatId)) ? await ChatModel.findOne({ _id: req.params.chatId, 'members.userId': me }).select('kind').lean() : null;
    if (!chat) return res.status(404).json({ message: 'No encontramos esa conversación.' });
    const outcome = patchOf(req.body, chat.kind === 'direct');
    if (!outcome.ok) return res.status(400).json({ message: outcome.reason });
    await ChatModel.updateOne({ _id: chat._id, 'members.userId': me }, outcome.patch);
    return res.json({ ok: true });
  }));
  return router;
}

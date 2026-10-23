import { Router } from 'express';
import { Types } from 'mongoose';
import { ageOn, limaDayKey, limaHour } from '@lilachat/shared';
import { asyncRoute, requireSession } from './requireSession.js';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { avisarEnElChat } from './chatRoutes.js';
import { avisarCambioDeChat } from './socket.js';

/** From this hour in Lima the day's birthdays are announced (design `c1`: «a partir de las 8:00»). */
const ANNOUNCE_FROM_HOUR = 8;
const CHECK_EVERY_MS = 15 * 60_000;

/**
 * Birthdays on or off in a chat (pending 17): a group's admins decide; in a
 * 1:1, either of the two. Off by default.
 */
export async function setChatBirthdays(params: { chatId: string; who: string; on: boolean }): Promise<{ ok: true; members: string[] } | { ok: false; status: 400 | 403; reason: string }> {
  const chat = Types.ObjectId.isValid(params.chatId) ? await ChatModel.findOne({ _id: params.chatId, 'members.userId': params.who }).select('kind members').lean() : null;
  if (!chat || (chat.kind !== 'group' && chat.kind !== 'direct')) return { ok: false, status: 400, reason: 'Los cumpleaños se activan en un grupo o en un chat de dos.' };
  const isAdmin = chat.members.some((member) => String(member.userId) === params.who && member.role === 'admin');
  if (chat.kind === 'group' && !isAdmin) return { ok: false, status: 403, reason: 'Solo los admins cambian esto.' };
  await ChatModel.updateOne({ _id: chat._id }, params.on ? { $set: { birthdaysOn: true } } : { $unset: { birthdaysOn: 1 } });
  return { ok: true, members: chat.members.map((member) => String(member.userId)) };
}

export function buildBirthdaysRouter(): Router {
  const router = Router();
  // Session per route, not `router.use`: mounted on a shared path.
  router.patch('/chats/:chatId/birthdays', requireSession, asyncRoute(async (req, res) => {
    const on = req.body?.on === true;
    const outcome = await setChatBirthdays({ chatId: req.params.chatId ?? '', who: String(req.session!.userId), on });
    if (!outcome.ok) return res.status(outcome.status).json({ message: outcome.reason });
    for (const id of outcome.members) avisarCambioDeChat(id, req.params.chatId!);
    return res.json({ ok: true, birthdaysOn: on });
  }));
  return router;
}

/**
 * Today's birthdays, once a day from 8:00 in Lima: «Hoy cumple Carla» in each
 * chat of hers that has them on. Only who chose to show their date
 * (`birthdayVisible`). Once per chat and day even with two servers on the same
 * base: the chat keeps the day it was announced (`birthdayNotices`), set
 * atomically before writing.
 */
export async function announceBirthdays(now: Date): Promise<void> {
  if (limaHour(now) < ANNOUNCE_FROM_HOUR) return;
  const dayKey = limaDayKey(now);
  const [, month, day] = dayKey.split('-').map(Number);
  const people = await UserModel.find({ 'birthday.day': day, 'birthday.month': month, birthdayVisible: { $ne: false } }).select('birthday').lean();
  for (const person of people) {
    const userId = String(person._id);
    const chats = await ChatModel.find({ 'members.userId': person._id, birthdaysOn: true }).select('_id').lean();
    const age = person.birthday ? ageOn({ day: person.birthday.day, month: person.birthday.month, year: person.birthday.year }, dayKey) : undefined;
    for (const chat of chats) {
      const claimed = await ChatModel.updateOne({ _id: chat._id, [`birthdayNotices.${userId}`]: { $ne: dayKey } }, { $set: { [`birthdayNotices.${userId}`]: dayKey } });
      if (claimed.modifiedCount === 0) continue;
      await avisarEnElChat({ chatId: String(chat._id), quien: person._id, evento: 'cumpleanos', ...(age ? { valor: String(age) } : {}) }).catch((error) => console.error('[cumpleaños] aviso:', error instanceof Error ? error.message : error));
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startBirthdayCron(): void {
  if (timer) return;
  const tick = () => void announceBirthdays(new Date()).catch((error) => console.error('[cron] cumpleaños:', error instanceof Error ? error.message : error));
  timer = setInterval(tick, CHECK_EVERY_MS);
  tick();
}

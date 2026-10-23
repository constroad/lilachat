import { Router } from 'express';
import { Types } from 'mongoose';
import { ageOn, birthdayHeadsUpText, limaDayKey, limaHour, limaTomorrowKey } from '@lilachat/shared';
import { pushTo } from './reminderCron.js';
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
  // The chat decides, not the person (José, 22/10, pending 71): an old «hidden» choice no longer blocks the notice.
  const people = await UserModel.find({ 'birthday.day': day, 'birthday.month': month }).select('birthday').lean();
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

/**
 * The day before a member's birthday, from 8:00 in Lima, the group's admins
 * (not the birthday person) get a heads-up to prepare something (pending 72,
 * José 22/10). Only groups with birthdays on; once per member and day.
 */
export async function warnAdminsOfTomorrow(now: Date): Promise<void> {
  if (limaHour(now) < ANNOUNCE_FROM_HOUR) return;
  const tomorrow = limaTomorrowKey(now);
  const [, month, day] = tomorrow.split('-').map(Number);
  const people = await UserModel.find({ 'birthday.day': day, 'birthday.month': month }).select('name birthday').lean();
  for (const person of people) {
    const userId = String(person._id);
    const groups = await ChatModel.find({ kind: 'group', birthdaysOn: true, 'members.userId': person._id }).select('name members').lean();
    const age = person.birthday ? ageOn({ day: person.birthday.day, month: person.birthday.month, year: person.birthday.year }, tomorrow) : undefined;
    for (const group of groups) {
      const admins = group.members.filter((member) => member.role === 'admin' && String(member.userId) !== userId).map((member) => String(member.userId));
      if (admins.length === 0) continue;
      const claimed = await ChatModel.updateOne({ _id: group._id, [`birthdayHeadsUps.${userId}`]: { $ne: tomorrow } }, { $set: { [`birthdayHeadsUps.${userId}`]: tomorrow } });
      if (claimed.modifiedCount === 0) continue;
      await pushTo(admins, group.name ?? 'Grupo', birthdayHeadsUpText(person.name ?? 'un miembro', age), { chatId: String(group._id), seq: 0 }).catch((error) => console.error('[cumpleaños] aviso a admins:', error instanceof Error ? error.message : error));
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startBirthdayCron(): void {
  if (timer) return;
  const tick = () => {
    const now = new Date();
    void announceBirthdays(now).catch((error) => console.error('[cron] cumpleaños:', error instanceof Error ? error.message : error));
    void warnAdminsOfTomorrow(now).catch((error) => console.error('[cron] cumpleaños de mañana:', error instanceof Error ? error.message : error));
  };
  timer = setInterval(tick, CHECK_EVERY_MS);
  tick();
}

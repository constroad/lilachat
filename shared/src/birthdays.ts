/**
 * Birthdays in chats (pending 17, José 20/10; design `c1-app-cumpleanos`):
 * at 8:00 in Lima the server leaves «Hoy cumple Carla» in each chat that has
 * them on, and on opening the chat that day the others see the card, once.
 * PURE. Peru has no daylight saving: Lima is always UTC−5.
 */
const LIMA_OFFSET_MS = 5 * 3_600_000;

const limaClock = (now: Date) => new Date(now.getTime() - LIMA_OFFSET_MS);

/** «2026-10-22»: today in Lima. */
export const limaDayKey = (now: Date): string => limaClock(now).toISOString().slice(0, 10);

export const limaHour = (now: Date): number => limaClock(now).getUTCHours();

type Birthday = { day: number; month: number; year?: number };

const partsOf = (dayKey: string) => {
  const [year, month, day] = dayKey.split('-').map(Number);
  return { year: year!, month: month!, day: day! };
};

export function isBirthdayToday(birthday: Birthday, dayKey: string): boolean {
  const today = partsOf(dayKey);
  return birthday.day === today.day && birthday.month === today.month;
}

/** The age they turn today; unknown without the year. */
export function ageOn(birthday: Birthday, dayKey: string): number | undefined {
  return birthday.year ? partsOf(dayKey).year - birthday.year : undefined;
}

type NoticeRow = { seq?: number; at?: string; senderId?: string; deletedAt?: string | null; system?: { evento?: string; valor?: string } };

/** The birthday card to show on opening a chat: today's notice of someone else, not seen yet. */
export function birthdayCardFor(rows: readonly NoticeRow[], params: { me: string; todayKey: string; seen: (seq: number) => boolean }): { seq: number; who: string; age?: number } | null {
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index]!;
    // A deleted notice is gone for everyone: no card (22/10, QA's deleted notice reached José's phone).
    if (row.system?.evento !== 'cumpleanos' || row.deletedAt || typeof row.seq !== 'number' || !row.at || !row.senderId) continue;
    if (limaDayKey(new Date(row.at)) !== params.todayKey || row.senderId === params.me || params.seen(row.seq)) continue;
    const age = Number(row.system.valor);
    return { seq: row.seq, who: row.senderId, ...(Number.isInteger(age) && age > 0 ? { age } : {}) };
  }
  return null;
}

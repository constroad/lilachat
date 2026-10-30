/**
 * Automatizaciones (pending 17, design `automatizaciones`): a chat that stays
 * quiet on a schedule, and a note for the next time I talk to someone. Both
 * belong to ONE member of one chat. PURE: server, app and web.
 */
export type QuietHours = { days: number[]; from: string; to: string; tz: string };
export type ContactNote = { text: string };

export const ROUTINE_NOTE_MAX = 200;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const MINUTES_PER_HOUR = 60;

const minutesOf = (clock: string) => Number(clock.slice(0, 2)) * MINUTES_PER_HOUR + Number(clock.slice(3, 5));

function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A valid schedule, or `null`: at least one day 0–6 (Sunday = 0), two different «HH:MM» and a real time zone. */
export function quietHoursOf(raw: unknown): QuietHours | null {
  const input = raw as Partial<QuietHours> | null;
  if (!input || !Array.isArray(input.days) || typeof input.from !== 'string' || typeof input.to !== 'string') return null;
  const days = [...new Set(input.days)].filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6).sort();
  if (days.length === 0 || days.length !== input.days.length || !CLOCK.test(input.from) || !CLOCK.test(input.to) || input.from === input.to) return null;
  if (!isTimeZone(input.tz)) return null;
  return { days, from: input.from, to: input.to, tz: input.tz };
}

/** The weekday and the minute of the day of `now` in that zone. */
function localClock(now: Date, tz: string): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? '';
  return { day: WEEKDAY_INDEX[part('weekday')] ?? 0, minute: Number(part('hour')) * MINUTES_PER_HOUR + Number(part('minute')) };
}

/** Whether the chat is quiet right now. A range across midnight belongs to the day it starts. */
export function isQuietNow(quiet: QuietHours, now: Date): boolean {
  const { day, minute } = localClock(now, quiet.tz);
  const from = minutesOf(quiet.from);
  const to = minutesOf(quiet.to);
  if (from < to) return quiet.days.includes(day) && minute >= from && minute < to;
  const yesterday = (day + 6) % 7;
  return (quiet.days.includes(day) && minute >= from) || (quiet.days.includes(yesterday) && minute < to);
}

function daysLabel(days: number[]): string {
  const key = days.join(',');
  if (key === '0,1,2,3,4,5,6') return 'Todos los días';
  if (key === '1,2,3,4,5') return 'Lun a vie';
  if (key === '0,6') return 'Sáb y dom';
  return days.map((day, index) => (index === 0 ? WEEKDAYS[day] : WEEKDAYS[day]!.toLowerCase())).join(', ');
}

/** «Lun a vie · 18:00–08:00». */
export const quietHoursLabel = (quiet: QuietHours): string => `${daysLabel(quiet.days)} · ${quiet.from}–${quiet.to}`;

/** The note for the next time I talk to someone, trimmed; empty or too long is `null`. */
export function contactNoteOf(raw: unknown): ContactNote | null {
  const text = typeof (raw as Partial<ContactNote> | null)?.text === 'string' ? (raw as ContactNote).text.trim() : '';
  if (!text || text.length > ROUTINE_NOTE_MAX) return null;
  return { text };
}

import type { Recurrence } from './events.js';

/**
 * How a reminder repeats beyond «every day / every week» (pending 65, José
 * 22/10, design `r150-repetir`): only some weekdays (Tuesdays and Thursdays),
 * the last day of the month (28, 29, 30 or 31; it is «the day before the 1st»),
 * the same day of the month, and every N days, weeks or months. Computed in
 * Lima time (UTC−5, no daylight saving). PURE.
 */
/** `day`: the day of the month asked for (1–31). The cron moves `startsAt` after each ring, so after February the 31st would become the 28th without it. */
export type RepeatRule = { every?: number; weekdays?: readonly number[]; monthDay?: 'same' | 'last'; day?: number };

const LIMA_OFFSET_MS = 5 * 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MAX_EVERY = 99;
/** Months a monthly search tries after jumping near «from»: one is behind, the next one is ahead. */
const MONTH_TRIES = 4;
/** Plural weekday names, Sunday first (`Date.getUTCDay`). */
const WEEKDAY_PLURALS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'] as const;

type LimaDay = { year: number; month: number; day: number; weekday: number; midnight: number; msOfDay: number };

function limaDay(date: Date): LimaDay {
  const shifted = new Date(date.getTime() - LIMA_OFFSET_MS);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate(), weekday: shifted.getUTCDay(), midnight, msOfDay: shifted.getTime() - midnight };
}

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const everyOf = (rule: RepeatRule | undefined): number => Math.min(MAX_EVERY, Math.max(1, Math.floor(rule?.every ?? 1)));

/** Strictly after `from`, jumping straight there (a reminder from months ago is not walked period by period). */
function nextByPeriod(start: number, from: number, periodMs: number): Date {
  if (start > from) return new Date(start);
  return new Date(start + (Math.floor((from - start) / periodMs) + 1) * periodMs);
}

function nextOnWeekdays(startsAt: Date, from: Date, weekdays: readonly number[], every: number): Date | null {
  const start = limaDay(startsAt);
  // Weeks are counted from the Monday of the first one: «every 2 weeks» keeps its rhythm.
  const anchorMonday = start.midnight - ((start.weekday + 6) % 7) * DAY_MS;
  const fromMidnight = limaDay(from).midnight;
  let cursor = Math.max(start.midnight, fromMidnight);
  // Jump to the cycle that holds «from», then walk at most two cycles day by day.
  cursor = Math.max(start.midnight, anchorMonday + Math.floor((cursor - anchorMonday) / (WEEK_MS * every)) * WEEK_MS * every);
  for (let step = 0; step < 14 * every + 7; step++, cursor += DAY_MS) {
    const weeks = Math.floor((cursor - anchorMonday) / WEEK_MS);
    if (!weekdays.includes(new Date(cursor).getUTCDay()) || weeks % every !== 0) continue;
    const candidate = cursor + start.msOfDay + LIMA_OFFSET_MS;
    if (candidate > from.getTime() && candidate >= startsAt.getTime()) return new Date(candidate);
  }
  return null;
}

function nextMonthly(startsAt: Date, from: Date, monthDay: 'same' | 'last', every: number, wantedDay?: number): Date | null {
  const start = limaDay(startsAt);
  const until = limaDay(from);
  const monthsApart = (until.year - start.year) * 12 + (until.month - start.month);
  let cycle = Math.max(0, Math.floor(monthsApart / every) - 1);
  for (let tries = 0; tries < MONTH_TRIES; tries++, cycle++) {
    const index = start.month + cycle * every;
    const year = start.year + Math.floor(index / 12);
    const month = index % 12;
    const last = daysInMonth(year, month);
    // A month without that day (the 31st in April, the 30th in February) rings on its last day.
    const day = monthDay === 'last' ? last : Math.min(wantedDay ?? start.day, last);
    const candidate = Date.UTC(year, month, day) + start.msOfDay + LIMA_OFFSET_MS;
    if (candidate > from.getTime() && candidate >= startsAt.getTime()) return new Date(candidate);
  }
  return null;
}

/**
 * The NEXT time a reminder rings, strictly after `from` («strictly»: one that
 * just rang must not come back at the same instant on the next cron run).
 */
export function nextRepeat(params: { startsAt: Date; recurrence: Recurrence; rule?: RepeatRule; from: Date }): Date | null {
  const { startsAt, recurrence, rule, from } = params;
  const every = everyOf(rule);
  if (recurrence === 'once') return startsAt.getTime() > from.getTime() ? new Date(startsAt.getTime()) : null;
  if (recurrence === 'daily') return nextByPeriod(startsAt.getTime(), from.getTime(), every * DAY_MS);
  if (recurrence === 'monthly') return nextMonthly(startsAt, from, rule?.monthDay ?? 'same', every, rule?.day);
  if (rule?.weekdays?.length) return nextOnWeekdays(startsAt, from, rule.weekdays, every);
  return nextByPeriod(startsAt.getTime(), from.getTime(), every * WEEK_MS);
}

/** The rule as it comes from a client: unknown fields dropped, days 0–6 without repeats, «every» 1–99. */
export function parseRepeatRule(raw: unknown): RepeatRule | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, unknown>;
  const rule: { every?: number; weekdays?: number[]; monthDay?: 'same' | 'last'; day?: number } = {};
  if (Array.isArray(input.weekdays)) {
    const days = [...new Set(input.weekdays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
    if (days.length) rule.weekdays = days;
  }
  if (typeof input.every === 'number' && Number.isFinite(input.every)) rule.every = Math.min(MAX_EVERY, Math.max(1, Math.floor(input.every)));
  if (input.monthDay === 'same' || input.monthDay === 'last') rule.monthDay = input.monthDay;
  if (Number.isInteger(input.day) && (input.day as number) >= 1 && (input.day as number) <= 31) rule.day = input.day as number;
  return Object.keys(rule).length ? rule : undefined;
}

const listOf = (words: readonly string[]): string => (words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} y ${words[words.length - 1]}`);

/** «Se repite los martes y jueves a las 9:00 a. m.»: the line under «Repetir». `startDay` is the day of the month it starts on. */
export function describeRepeat(recurrence: Recurrence, rule: RepeatRule | undefined, timeLabel: string, startDay?: number): string {
  const every = everyOf(rule);
  const at = `a las ${timeLabel}`;
  if (recurrence === 'once') return '';
  if (recurrence === 'daily') return every > 1 ? `Se repite cada ${every} días ${at}` : `Se repite todos los días ${at}`;
  if (recurrence === 'monthly') {
    const which = rule?.monthDay === 'last' ? 'el último día' : `el día ${rule?.day ?? startDay ?? 1}`;
    return `Se repite ${which} ${every > 1 ? `cada ${every} meses` : 'de cada mes'} ${at}`;
  }
  const cadence = every > 1 ? `cada ${every} semanas ` : '';
  if (!rule?.weekdays?.length) return every > 1 ? `Se repite cada ${every} semanas ${at}` : `Se repite cada semana ${at}`;
  // Monday first, as the week is read in Peru.
  const days = [...rule.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((day) => WEEKDAY_PLURALS[day]!);
  return `Se repite ${cadence}los ${listOf(days)} ${at}`;
}

/** Short weekday names for a label, Sunday first. */
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

/** The short label on a card or a list row: «Mar y jue», «Fin de mes», «Cada 2 semanas». `base` is the plain one («Semanal»). */
export function repeatLabel(recurrence: Recurrence, rule: RepeatRule | undefined, base: string): string {
  const every = everyOf(rule);
  if (recurrence === 'monthly' && rule?.monthDay === 'last') return every > 1 ? `Fin de mes, cada ${every} meses` : 'Fin de mes';
  if (recurrence === 'weekly' && rule?.weekdays?.length) {
    const days = [...rule.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((day, index) => (index === 0 ? WEEKDAY_SHORT[day]! : WEEKDAY_SHORT[day]!.toLowerCase()));
    return every > 1 ? `${listOf(days)}, cada ${every} semanas` : listOf(days);
  }
  if (every > 1) return `Cada ${every} ${recurrence === 'daily' ? 'días' : recurrence === 'weekly' ? 'semanas' : 'meses'}`;
  return base;
}

/** The rule as stored: a monthly «same day» keeps the day it started on (Lima). */
export function anchorRepeatRule(recurrence: Recurrence, rule: RepeatRule | undefined, startsAt: Date): RepeatRule | undefined {
  if (recurrence !== 'monthly' || rule?.monthDay === 'last' || rule?.day) return rule;
  return { ...rule, monthDay: 'same', day: limaDay(startsAt).day };
}

/** The weekday (0 = Sunday) and the day of the month of a moment, in Lima: the defaults of the picker. */
export const limaWeekday = (date: Date): number => limaDay(date).weekday;
export const limaMonthDay = (date: Date): number => limaDay(date).day;

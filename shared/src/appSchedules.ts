import type { BotCommand } from './botCommands.js';
import type { Recurrence } from './events.js';
import { nextRepeat, type RepeatRule } from './repeatRule.js';

/**
 * Schedules (José, 28/10; agentes `specs/COMANDOS-Y-HORARIOS.spec.md` §3): a
 * read command that runs at a time and posts its report, with the same
 * repetition as a reminder. PURE: the server validates and decides with it,
 * the app and the web draw it.
 */
/** Every N days, or some weekdays (`Date.getUTCDay` of the Lima day: 0 = Sunday). */
export type ScheduleRepeat = { every: number } | { weekdays: number[] };
/** What an app suggests in its manifest (`suggested_schedules`), offered to the admin with one tap. */
export type SuggestedSchedule = { command: string; text: string; time: string; repeat: ScheduleRepeat; onlyIfSomething: boolean };
/** Where it posts: a channel of the space, or the creator's 1:1 with the app. */
export type SchedulePlace = 'direct' | { chatId: string };
export type ScheduleInput = { command: string; text: string; time: string; repeat: ScheduleRepeat; place: SchedulePlace; onlyIfSomething: boolean };
/** How the last run went: «No corrió el 27/10: la app no respondió» (design d-03). */
export type ScheduleOutcome = 'posted' | 'nothing' | 'pending' | 'failed' | 'missed' | 'refused';
export type ScheduleLastRun = { scheduledFor: string; at: string; outcome: ScheduleOutcome; message?: string };
export type ScheduleWhere = { kind: 'channel'; chatId: string; name: string } | { kind: 'direct' };
/** A schedule as «Horarios» lists it. */
export type ScheduleRow = { id: string; command: string; text: string; time: string; repeat: ScheduleRepeat; onlyIfSomething: boolean; active: boolean; where: ScheduleWhere; createdBy: string; lastRun?: ScheduleLastRun };
export type AppSchedules = { schedules: ScheduleRow[]; suggested: SuggestedSchedule[]; canEdit: boolean };

export const SCHEDULE_LIMITS = { suggested: 10, text: 200, every: 30, perApp: 30 };
/** Lilachat down at 10:30 and back at 10:50 still posts the report; past this it is missed and the creator is told. */
export const SCHEDULE_LATE_MS = 30 * 60_000;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const OBJECT_ID = /^[a-f0-9]{24}$/;
const LIMA_OFFSET_MS = 5 * 3_600_000;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 3_600_000;

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const text = (value: unknown): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, SCHEDULE_LIMITS.text) : '');

export function parseScheduleRepeat(raw: unknown): ScheduleRepeat | null {
  const entry = record(raw);
  if (Array.isArray(entry.weekdays)) {
    const days = [...new Set(entry.weekdays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
    return days.length ? { weekdays: days } : null;
  }
  const every = entry.every;
  return typeof every === 'number' && Number.isInteger(every) && every >= 1 && every <= SCHEDULE_LIMITS.every ? { every } : null;
}

/** The manifest's suggestions: only commands the app marks schedulable; what does not fit is dropped, never refused. */
export function validateSuggestedSchedules(raw: unknown, commands: readonly Pick<BotCommand, 'command' | 'schedulable'>[]): SuggestedSchedule[] {
  if (!Array.isArray(raw)) return [];
  const schedulable = new Set(commands.filter((entry) => entry.schedulable).map((entry) => entry.command));
  return raw.slice(0, SCHEDULE_LIMITS.suggested).flatMap((item): SuggestedSchedule[] => {
    const entry = record(item);
    const repeat = parseScheduleRepeat(entry.repeat);
    const time = typeof entry.time === 'string' ? entry.time : '';
    if (typeof entry.command !== 'string' || !schedulable.has(entry.command) || !TIME.test(time) || !repeat) return [];
    return [{ command: entry.command, text: text(entry.text), time, repeat, onlyIfSomething: entry.only_if_something === true }];
  });
}

export function recurrenceOf(repeat: ScheduleRepeat): { recurrence: Recurrence; rule: RepeatRule | undefined } {
  if ('weekdays' in repeat) return { recurrence: 'weekly', rule: { weekdays: repeat.weekdays } };
  return { recurrence: 'daily', rule: repeat.every > 1 ? { every: repeat.every } : undefined };
}

/** The first time it runs from `now`: today at that hour in Lima if it has not passed and applies, else the next. */
export function firstRunAt(time: string, repeat: ScheduleRepeat, now: Date): Date {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  const limaMidnight = Math.floor((now.getTime() - LIMA_OFFSET_MS) / DAY_MS) * DAY_MS + LIMA_OFFSET_MS;
  const todayAt = new Date(limaMidnight + (hours * 60 + minutes) * MINUTE_MS);
  const { recurrence, rule } = recurrenceOf(repeat);
  // From a minute before today's slot, so a slot that is still ahead counts and the weekdays are honored.
  return nextRepeat({ startsAt: todayAt, recurrence, rule, from: new Date(Math.max(now.getTime(), todayAt.getTime() - 1)) }) ?? todayAt;
}

export function scheduleDecision(scheduledFor: Date, now: Date): 'run' | 'missed' {
  return now.getTime() - scheduledFor.getTime() > SCHEDULE_LATE_MS ? 'missed' : 'run';
}

/** Only read commands; amounts (`shareable: false`) only in the creator's 1:1, because the products refuse them in any group. */
export function schedulePlaceProblem(command: Pick<BotCommand, 'command' | 'schedulable' | 'shareable'>, target: 'direct' | 'channel'): string | null {
  if (!command.schedulable) return `/${command.command} no se puede programar: solo se programan consultas.`;
  if (command.shareable === false && target === 'channel') return `/${command.command} tiene montos: solo se programa en tu chat con la app.`;
  return null;
}

/** `{ command, text, time, repeat, chat_id: '<id>' | 'direct', only_if_something }` from the admin's «Programar». */
export function validateScheduleInput(raw: unknown): { ok: true; input: ScheduleInput } | { ok: false; message: string } {
  const body = record(raw);
  if (typeof body.command !== 'string' || !body.command) return { ok: false, message: 'Elige el comando.' };
  const time = typeof body.time === 'string' ? body.time : '';
  if (!TIME.test(time)) return { ok: false, message: 'La hora va como HH:mm, de 00:00 a 23:59.' };
  const repeat = parseScheduleRepeat(body.repeat);
  if (!repeat) return { ok: false, message: 'Elige los días: todos, cada N días o algunos días de la semana.' };
  const chat = body.chat_id;
  const place: SchedulePlace | null = chat === 'direct' ? 'direct' : typeof chat === 'string' && OBJECT_ID.test(chat) ? { chatId: chat } : null;
  if (!place) return { ok: false, message: 'Elige el canal o tu chat con la app.' };
  return { ok: true, input: { command: body.command, text: text(body.text), time, repeat, place, onlyIfSomething: body.only_if_something === true } };
}

/** The body of POST …/schedules, the inverse of `validateScheduleInput`. */
export function scheduleRequestOf(input: ScheduleInput): Record<string, unknown> {
  return { command: input.command, text: input.text, time: input.time, repeat: input.repeat, chat_id: input.place === 'direct' ? 'direct' : input.place.chatId, only_if_something: input.onlyIfSomething };
}

const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;
const sameDays = (days: readonly number[], wanted: readonly number[]) => days.length === wanted.length && wanted.every((day) => days.includes(day));
const listOf = (words: readonly string[]): string => (words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} y ${words[words.length - 1]}`);

function daysLabel(repeat: ScheduleRepeat): string {
  if ('every' in repeat) return repeat.every === 1 ? 'todos los días' : `cada ${repeat.every} días`;
  if (sameDays(repeat.weekdays, [0, 1, 2, 3, 4, 5, 6])) return 'todos los días';
  if (sameDays(repeat.weekdays, [1, 2, 3, 4, 5, 6])) return 'lunes a sábado';
  if (sameDays(repeat.weekdays, [1, 2, 3, 4, 5])) return 'lunes a viernes';
  // Monday first, as the week is read in Peru.
  return listOf([...repeat.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((day) => WEEKDAY_SHORT[day]!));
}

/** «10:30 · lunes a sábado · # planta-asfalto · solo si hay algo» (design d-03); a suggestion has no place yet. */
export function scheduleLine(schedule: { time: string; repeat: ScheduleRepeat; onlyIfSomething: boolean }, where: string): string {
  return [schedule.time, daysLabel(schedule.repeat), ...(where ? [where] : []), ...(schedule.onlyIfSomething ? ['solo si hay algo'] : [])].join(' · ');
}

/** What the creator reads in their 1:1 with the app when a schedule did not post (§3.1): nothing is left in anyone else's name. */
export function scheduleNotRunText(command: string, time: string, reason: string): string {
  return `El horario de /${command} de las ${time} no corrió: ${reason}`;
}

export function scheduleWhere(where: ScheduleWhere): string {
  return where.kind === 'channel' ? `# ${where.name}` : 'tu chat con la app';
}

const NOT_RUN: readonly ScheduleOutcome[] = ['failed', 'missed', 'refused'];
const MISSED_REASON = 'Lilachat no estaba disponible a esa hora.';

/** The red line under a schedule whose last run did not post; the day is Lima's. */
export function lastRunProblem(lastRun: ScheduleLastRun | undefined): string | null {
  if (!lastRun || !NOT_RUN.includes(lastRun.outcome)) return null;
  const limaDay = new Date(new Date(lastRun.scheduledFor).getTime() - LIMA_OFFSET_MS);
  const day = `${String(limaDay.getUTCDate()).padStart(2, '0')}/${String(limaDay.getUTCMonth() + 1).padStart(2, '0')}`;
  const reason = (lastRun.message ?? (lastRun.outcome === 'missed' ? MISSED_REASON : 'la app no respondió.')).replace(/\.$/, '');
  // «La app no respondió» reads «la app…» after the colon; a name («Lilachat», «Inframaq») keeps its capital.
  const opening = /^(La|El|Los|Las|Un|Una|Ese|Esa|No)\b/.test(reason) ? `${reason.charAt(0).toLowerCase()}${reason.slice(1)}` : reason;
  return `No corrió el ${day}: ${opening}`;
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** The days picked in «Programar» (0 = Sunday); «cada N días» shows as every day until the admin picks. */
export function weekdaysOf(repeat: ScheduleRepeat): number[] {
  return 'weekdays' in repeat ? [...repeat.weekdays] : [...EVERY_DAY];
}

export function repeatOfDays(days: readonly number[]): ScheduleRepeat | null {
  const picked = [...new Set(days)].filter((day) => EVERY_DAY.includes(day)).sort((a, b) => a - b);
  if (!picked.length) return null;
  return picked.length === EVERY_DAY.length ? { every: 1 } : { weekdays: picked };
}

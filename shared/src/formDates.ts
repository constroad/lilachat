/**
 * Dates and times of an app's form (José, 24/10: «la fecha por defecto en la
 * fecha actual, y un selector, no un input»). The stored value is text in the
 * phone's own clock, which is what the pickers of the app and the web produce:
 * `2026-10-24`, `08:05`, `2026-10-24T08:05`. PURE.
 */
export type DateMode = 'date' | 'time' | 'date-time';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{1,2}):(\d{2})$/;
/** A moment: the T (the older app typed a space), optional seconds and a zone that an API client may send. */
const MOMENT = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const LAST_HOUR = 23;
const LAST_MINUTE = 59;

const pad = (value: number) => String(value).padStart(2, '0');
const clockExists = (hours: number, minutes: number) => hours <= LAST_HOUR && minutes <= LAST_MINUTE;

/** February 30th rolls over to March in a `Date`; a form must refuse it. */
function dayExists(year: number, month: number, day: number): boolean {
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}

/** The value as the phone clock reads it: `2026-10-24`, `08:05` or `2026-10-24T08:05`. */
export function formatFormDate(date: Date, mode: DateMode): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return mode === 'date' ? day : mode === 'time' ? clock : `${day}T${clock}`;
}

/** The clean text and the local moment it stands for; null when it is not a real date or time. */
function read(value: unknown, mode: DateMode, base: Date): { clean: string; at: Date } | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (mode === 'time') {
    const [, hours, minutes] = TIME.exec(text) ?? [];
    if (hours === undefined || minutes === undefined || !clockExists(Number(hours), Number(minutes))) return null;
    return { clean: `${pad(Number(hours))}:${minutes}`, at: new Date(base.getFullYear(), base.getMonth(), base.getDate(), Number(hours), Number(minutes)) };
  }
  const [, year, month, day, hours = '0', minutes = '0'] = (mode === 'date' ? DATE : MOMENT).exec(text) ?? [];
  if (year === undefined || month === undefined || day === undefined) return null;
  if (!dayExists(Number(year), Number(month), Number(day)) || !clockExists(Number(hours), Number(minutes))) return null;
  return { clean: mode === 'date' ? text : text.replace(' ', 'T'), at: new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)) };
}

/** The text a field may carry, cleaned (`7:30` → `07:30`, a space → T), or null when it is not valid. */
export function normalizeFormDate(value: unknown, mode: DateMode): string | null {
  return read(value, mode, new Date())?.clean ?? null;
}

/** The value as a local `Date`, for the picker to open on it; a time of day lands on `base`'s day. */
export function parseFormDate(value: unknown, mode: DateMode, base: Date = new Date()): Date | null {
  return read(value, mode, base)?.at ?? null;
}

/** What a form starts with: today for a date, now for a moment; a time of day starts empty (it is a decision). */
export function startingMoment(mode: DateMode, now: Date): string | undefined {
  return mode === 'time' ? undefined : formatFormDate(now, mode);
}

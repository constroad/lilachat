/**
 * Silenciar por 8 horas, 1 semana o siempre, como WhatsApp (R31/10; §66 lo
 * dejó pendiente: el server no tenía silencio por tiempo). The end is stored
 * as `mutedUntil`; past it the chat rings again without anyone writing to the
 * base, because every reader asks `isMutedNow`.
 */
export type MuteFor = '8h' | '1w' | 'always';

export const MUTE_OPTIONS: readonly { key: MuteFor; label: string }[] = [
  { key: '8h', label: '8 horas' },
  { key: '1w', label: '1 semana' },
  { key: 'always', label: 'Siempre' },
];

const HOUR_MS = 3_600_000;
const HOURS_PER_WEEK = 168;
const MUTE_MS: Record<Exclude<MuteFor, 'always'>, number> = { '8h': 8 * HOUR_MS, '1w': HOURS_PER_WEEK * HOUR_MS };
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

export const isMuteFor = (value: unknown): value is MuteFor => MUTE_OPTIONS.some((option) => option.key === value);

/** When a silence chosen now ends; `null` = siempre. */
export function mutedUntilFor(key: MuteFor, now: Date): Date | null {
  return key === 'always' ? null : new Date(now.getTime() + MUTE_MS[key]);
}

const endOf = (until: Date | string | null | undefined): number | null => {
  if (until === null || until === undefined) return null;
  const at = new Date(until).getTime();
  return Number.isNaN(at) ? null : at;
};

/** Whether a member's silence holds right now: no end = siempre. */
export function isMutedNow(member: { muted?: boolean; mutedUntil?: Date | string | null }, now: Date = new Date()): boolean {
  if (member.muted !== true) return false;
  const end = endOf(member.mutedUntil);
  return end === null || end > now.getTime();
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function localParts(at: Date, timeZone?: string): { day: string; month: number; year: string; time: string } {
  const key = timeZone ?? '';
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    formatters.set(key, format);
  }
  const parts = format.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((one) => one.type === type)?.value ?? '';
  return { day: String(Number(part('day'))), month: Number(part('month')) - 1, year: part('year'), time: `${part('hour')}:${part('minute')}` };
}

/** «hasta las 18:00» today, «hasta el 7 nov.» another day; empty with no end. */
export function mutedUntilShort(until: Date | string | null | undefined, now: Date, timeZone?: string): string {
  const end = endOf(until);
  if (end === null) return '';
  const at = localParts(new Date(end), timeZone);
  const today = localParts(now, timeZone);
  const sameDay = at.day === today.day && at.month === today.month && at.year === today.year;
  return sameDay ? `hasta las ${at.time}` : `hasta el ${at.day} ${MONTHS[at.month]}.`;
}

/** «Silenciado hasta las 18:00», or «Silenciado» with no end. */
export function mutedUntilText(until: Date | string | null | undefined, now: Date, timeZone?: string): string {
  const short = mutedUntilShort(until, now, timeZone);
  return short ? `Silenciado ${short}` : 'Silenciado';
}

/** What a list row and a chat's detail say about MY silence: muted only while it holds, and its end if it has one. */
export function muteStateOf(member: { muted?: boolean; mutedUntil?: Date | string | null } | undefined, now: Date = new Date()): { muted: boolean; mutedUntil?: string } {
  if (!member || !isMutedNow(member, now)) return { muted: false };
  const end = endOf(member.mutedUntil);
  return end === null ? { muted: true } : { muted: true, mutedUntil: new Date(end).toISOString() };
}

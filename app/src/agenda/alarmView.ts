import { advanceShort, formatClock } from '@lilachat/shared';

/**
 * What the full-screen alert says (Stitch a-01 «recordatorio sonando» and
 * a-02 «evento por empezar», dark lila to black; José 29/10). PURE: the screen
 * only draws it.
 */
export const SNOOZE_DEFAULT = 5;
const SNOOZE_STEP = 5;
const SNOOZE_MAX = 60;
const MINUTE_MS = 60_000;
const ADVANCE_PREFIX = 'Empieza en ';

const validDate = (iso: string | undefined): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** «Evento» when it rings before its start or has a place; a plain reminder otherwise. */
export function alarmKicker(params: { startsAt: string | undefined; hasPlace: boolean; now: Date }): 'Evento' | 'Recordatorio' {
  const start = validDate(params.startsAt);
  const early = start !== null && start.getTime() - params.now.getTime() >= MINUTE_MS;
  return early || params.hasPlace ? 'Evento' : 'Recordatorio';
}

/** Intl puts narrow no-break spaces in «p. m.»; the screen and the tests want plain ones. */
const plainSpaces = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** «Hoy 4:00 p. m.», «Mañana 9:00 a. m.» or «mar 3 nov, 9:00 a. m.», by calendar day. */
export function alarmWhen(startsAt: string | undefined, now: Date): string {
  const start = validDate(startsAt);
  if (!start) return '';
  const clock = plainSpaces(formatClock(start));
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (dayKey(start) === dayKey(now)) return `Hoy ${clock}`;
  if (dayKey(start) === dayKey(tomorrow)) return `Mañana ${clock}`;
  const parts = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(start);
  const part = (type: Intl.DateTimeFormatPartTypes) => (parts.find((one) => one.type === type)?.value ?? '').replace('.', '');
  return `${part('weekday')} ${part('day')} ${part('month')}, ${clock}`;
}

/** «Empieza en 19 min», «Ahora», «Empezó hace 5 min»: counted live, not as the server sent it. */
export function alarmCountdown(startsAt: string | undefined, now: Date): string | null {
  const start = validDate(startsAt);
  if (!start) return null;
  const minutes = Math.round((start.getTime() - now.getTime()) / MINUTE_MS);
  if (minutes === 0) return 'Ahora';
  return minutes > 0 ? `${ADVANCE_PREFIX}${advanceShort(minutes)}` : `Empezó hace ${advanceShort(-minutes)}`;
}

/** The server puts «Empieza en …» in front of the note; the screen counts it itself. */
export function noteWithoutAdvance(note: string): string {
  if (!note.startsWith(ADVANCE_PREFIX)) return note;
  const cut = note.indexOf(' · ');
  return cut === -1 ? '' : note.slice(cut + 3).trim();
}

/** The − and + of «Posponer 5 min»: steps of 5, between 5 and 60. */
export const nextSnooze = (minutes: number, direction: 1 | -1): number => Math.min(SNOOZE_MAX, Math.max(SNOOZE_STEP, minutes + direction * SNOOZE_STEP));

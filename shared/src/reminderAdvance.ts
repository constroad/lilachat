/**
 * Advance alerts of a reminder (José 25/10): «avisar 15 minutos antes», configurable and several
 * per reminder. PURE: the cron decides with `advanceDue`, the forms read and write with the rest.
 */
export const ADVANCE_PRESETS = [5, 15, 30, 60, 1440] as const;
/** A new reminder starts with this advance; the person removes or changes it. */
export const DEFAULT_ADVANCE: readonly number[] = [15];
export const MAX_ADVANCES = 5;
export const MAX_ADVANCE_MINUTES = 7 * 1440;
/** An advance alert that rings later than this after its time is dropped: an old notice helps nobody. */
const LATE_TOLERANCE_MS = 3 * 60_000;
const MINUTE_MS = 60_000;
const NUMBER_TEXT = /^\d+$/;

export const ADVANCE_INVALID_TEXT = 'Escribe una cantidad entera, de 1 minuto a 7 días.';
export const ADVANCE_FULL_TEXT = `Hasta ${MAX_ADVANCES} avisos por recordatorio.`;

export type AdvanceUnit = 'min' | 'h' | 'dia';
const UNIT_MINUTES: Record<AdvanceUnit, number> = { min: 1, h: 60, dia: 1440 };

function wholeMinutes(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && NUMBER_TEXT.test(value) ? Number(value) : Number.NaN;
  return Number.isInteger(number) && number >= 1 && number <= MAX_ADVANCE_MINUTES ? number : null;
}

/** The advances that count: whole minutes up to a week, each once, the longest first, at most five. */
export function parseAdvance(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set<number>();
  for (const value of raw) {
    const minutes = wholeMinutes(value);
    if (minutes !== null) valid.add(minutes);
  }
  return [...valid].sort((a, b) => b - a).slice(0, MAX_ADVANCES);
}

/** A chip of the form: adds the advance or removes it. Past the limit, or invalid, nothing changes. */
export function toggleAdvance(current: readonly number[], minutes: number): number[] {
  if (current.includes(minutes)) return current.filter((one) => one !== minutes);
  if (wholeMinutes(minutes) === null || current.length >= MAX_ADVANCES) return [...current];
  return parseAdvance([...current, minutes]);
}

/** What the person typed in the «otro» field: a quantity and its unit, to minutes; null when it does not count. */
export function advanceToMinutes(value: number, unit: AdvanceUnit): number | null {
  return Number.isInteger(value) ? wholeMinutes(value * UNIT_MINUTES[unit]) : null;
}

function durationText(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return [days ? `${days} ${days === 1 ? 'día' : 'días'}` : '', hours ? `${hours} h` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ');
}

/** «15 min antes», «1 h 30 min antes», «2 días antes». */
export const advanceLabel = (minutes: number): string => `${durationText(minutes)} antes`;
/** The chip's text: «15 min», «1 h», «1 día». */
export const advanceShort = (minutes: number): string => durationText(minutes);
/** «Avisa 1 h y 15 min antes», for a card or a detail. Empty when there is no advance. */
export function advanceSummary(advance: readonly number[] | undefined): string {
  const list = parseAdvance(advance ?? []).map(advanceShort);
  if (list.length === 0) return '';
  const joined = list.length === 1 ? list[0]! : `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
  return `Avisa ${joined} antes`;
}
/** The chips of the form: the usual advances plus whatever custom one is selected, shortest first. */
export const advanceChips = (selected: readonly number[]): number[] => [...new Set([...ADVANCE_PRESETS, ...selected])].sort((a, b) => a - b);

/** The line the alert carries: as configured, not as the cron measured it. */
export const advanceNote = (minutes: number): string => `Empieza en ${durationText(minutes)}`;

/**
 * What the cron does with the advances of a reminder at `now`: `ring` is the one to ring (the closest
 * to the start when several are due together), `stamp` everything to mark as handled — also the late
 * ones and, once it started, whatever is left.
 */
export function advanceDue(params: { startsAt: Date; advance: readonly number[]; sent: readonly number[]; now: Date }): { ring: number | null; stamp: number[] } {
  const { startsAt, now } = params;
  const stamp: number[] = [];
  const onTime: number[] = [];
  for (const minutes of [...params.advance].sort((a, b) => b - a)) {
    if (params.sent.includes(minutes)) continue;
    const late = now.getTime() - (startsAt.getTime() - minutes * MINUTE_MS);
    if (late < 0) continue;
    stamp.push(minutes);
    if (late <= LATE_TOLERANCE_MS && now.getTime() < startsAt.getTime()) onTime.push(minutes);
  }
  return { ring: onTime.length > 0 ? Math.min(...onTime) : null, stamp };
}

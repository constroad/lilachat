import { dayOf } from './serviceDetail.js';
import { metersLabel, stationLabel, type WorkMap, type WorkMapProgress } from './workMap.js';
import { undoableIds, type ByApproveList, type ByApproveProgress } from './workByApprove.js';

/**
 * «Avances» (design ma05, José 28/11; Portal's approved prototype): every progress of the work in one
 * list — what waits and what was refused (`avances_por_aprobar_de_obra`) plus what was approved (the
 * map's `progress[]`, which carries no author) — filtered by «Hoy / Semana / Todo» on Lima days.
 * PURE: the APK and the web draw what this decides.
 */
export type FeedState = 'pendiente' | 'aprobado' | 'rechazado';
export type FeedRange = 'hoy' | 'semana' | 'todo';
export type FeedCard = {
  id: string;
  state: FeedState;
  pill: string;
  date: string;
  when: string;
  title: string;
  color: string | null;
  stretch: string;
  lengthM: number;
  meters: string;
  areaM2: number | null;
  area: string | null;
  author: string | null;
  rejectNote: string | null;
  /** «Deshacer»: the caller's newest pending one of its street and work. */
  undoable: boolean;
  /** «Aprobar» / «Rechazar» for an admin: only what still waits. */
  resolvable: boolean;
  toM: number | null;
};
export type FeedSummary = { meters: string; area: string | null; count: string };

export const FEED_PILL: Record<FeedState, string> = { pendiente: 'POR APROBAR', aprobado: 'APROBADO', rechazado: 'RECHAZADO' };
export const FEED_RANGES: ReadonlyArray<{ id: FeedRange; label: string }> = [{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Semana' }, { id: 'todo', label: 'Todo' }];
export const FEED_TITLE = 'Avances';
export const FEED_EMPTY = 'No hay avances en este periodo.';
export const FEED_SUMMARY_KICKER = 'Resumen';

const NO_WORK = 'Trabajo';
const NO_STREET = 'Calle sin nombre';
const WEEK_DAYS = 7;
const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const dayKey = (date: string) => date.slice(0, 10);
const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** «Hoy», «Ayer» or «20 nov»; nothing for an undated one. */
export function feedWhen(date: string, today: string): string {
  const day = dayKey(date);
  if (!DATE_ONLY.test(day)) return '';
  if (day === today) return 'Hoy';
  return day === shiftDay(today, -1) ? 'Ayer' : dayOf(day);
}

type CardBase = { id: string; state: FeedState; date: string; streetId: string | null; workId: string | null; fromM: number | null; toM: number | null; quantity: number; author: string | null; rejectNote: string | null };

function cardOf(map: Pick<WorkMap, 'streets' | 'works'>, base: CardBase, today: string, undoable: Set<string>): FeedCard {
  const street = map.streets.find((one) => one.id === base.streetId);
  const work = map.works.find((one) => one.id === base.workId);
  const hasStretch = base.fromM !== null && base.toM !== null && base.toM > base.fromM;
  const lengthM = hasStretch ? base.toM! - base.fromM! : Math.max(0, base.quantity);
  const areaM2 = street?.widthM ? lengthM * street.widthM : null;
  return {
    id: base.id,
    state: base.state,
    pill: FEED_PILL[base.state],
    date: base.date,
    when: feedWhen(base.date, today),
    title: `${work?.name ?? NO_WORK} · ${street?.name ?? NO_STREET}`,
    color: work?.color ?? null,
    stretch: hasStretch ? `${stationLabel(base.fromM!)} → ${stationLabel(base.toM!)}` : '',
    lengthM,
    meters: metersLabel(lengthM),
    areaM2,
    area: areaM2 === null ? null : `${metersLabel(areaM2).slice(0, -2)} m²`,
    author: base.author,
    rejectNote: base.rejectNote,
    undoable: undoable.has(base.id),
    resolvable: base.state === 'pendiente',
    toM: base.toM,
  };
}

const fromByApprove = (one: ByApproveProgress): CardBase => ({ id: one.id, state: one.state, date: one.date, streetId: one.streetId, workId: one.workId, fromM: one.fromM, toM: one.toM, quantity: one.quantity, author: one.author, rejectNote: one.rejectNote });
const fromApproved = (one: WorkMapProgress, index: number): CardBase => ({ id: `aprobado-${one.streetId}-${one.workId}-${index}`, state: 'aprobado', date: one.date, streetId: one.streetId, workId: one.workId, fromM: one.fromM, toM: one.toM, quantity: 0, author: null, rejectNote: null });

/** Newest first; on the same day what waits or was refused goes before what was approved. */
export function progressFeedOf(map: Pick<WorkMap, 'streets' | 'works' | 'progress'>, list: ByApproveList | null, today: string): FeedCard[] {
  const undoable = undoableIds(list);
  const bases = [...(list?.items ?? []).map(fromByApprove), ...map.progress.map(fromApproved)];
  const cards = bases.map((base) => cardOf(map, base, today, undoable));
  // ISO day keys sort as plain strings; localeCompare would build a collator per call on Hermes.
  return cards.sort((one, other) => { const [left, right] = [dayKey(other.date), dayKey(one.date)]; return left < right ? -1 : left > right ? 1 : 0; });
}

/** «Hoy», the last seven days, or all; an undated one only in «Todo». */
export function feedInRange(cards: readonly FeedCard[], range: FeedRange, today: string): FeedCard[] {
  if (range === 'todo') return [...cards];
  const since = range === 'hoy' ? today : shiftDay(today, 1 - WEEK_DAYS);
  return cards.filter((card) => DATE_ONLY.test(dayKey(card.date)) && dayKey(card.date) >= since && dayKey(card.date) <= today);
}

export const feedCounts = (cards: readonly FeedCard[], today: string): Record<FeedRange, number> =>
  ({ hoy: feedInRange(cards, 'hoy', today).length, semana: feedInRange(cards, 'semana', today).length, todo: cards.length });

/** «126 m lineales · 836 m² totales» of what is not refused. */
export function feedSummaryOf(cards: readonly FeedCard[]): FeedSummary {
  const counted = cards.filter((card) => card.state !== 'rechazado');
  const meters = counted.reduce((total, card) => total + card.lengthM, 0);
  const areas = counted.flatMap((card) => (card.areaM2 === null ? [] : [card.areaM2]));
  const area = areas.length ? metersLabel(areas.reduce((total, one) => total + one, 0)).slice(0, -2) : null;
  return { meters: metersLabel(meters).slice(0, -2), area, count: `${counted.length} avance${counted.length === 1 ? '' : 's'}` };
}

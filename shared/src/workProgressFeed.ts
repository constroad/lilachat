import { dayOf } from './serviceDetail.js';
import { metersLabel, stationLabel, type WorkMap, type WorkMapProgress } from './workMap.js';
import { undoableIds, type ByApproveList, type ByApproveProgress } from './workByApprove.js';

/**
 * «Avances» (design ma05, José 28/11; Portal's approved prototype): every progress of the work in one
 * list — what Portal keeps pending or was undone (`avances_por_aprobar_de_obra`) plus what is done (the
 * map's `progress[]`, which carries no author) — filtered by «Hoy / Semana / Todo» on Lima days. Since
 * 28/11 nothing waits for an admin: pending and done read the same, only an undone one has a pill.
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
  /** «Deshacer»: the caller's newest pending one of its street and work; for an admin, any that counts. */
  undoable: boolean;
  toM: number | null;
  /** Photos on it; «Agregar foto» only on a record Portal named that was not undone. */
  photos: number;
  photoable: boolean;
};
export type FeedSummary = { meters: string; area: string | null; count: string };

export const FEED_PILL: Record<FeedState, string> = { pendiente: '', aprobado: '', rechazado: 'DESHECHO' };
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

type CardBase = { id: string; state: FeedState; date: string; streetId: string | null; workId: string | null; fromM: number | null; toM: number | null; quantity: number; author: string | null; rejectNote: string | null; photos: number };

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
    toM: base.toM,
    photos: base.photos,
    photoable: base.state !== 'rechazado' && !base.id.startsWith(UNNAMED_PREFIX),
  };
}

const fromByApprove = (one: ByApproveProgress): CardBase => ({ id: one.id, state: one.state, date: one.date, streetId: one.streetId, workId: one.workId, fromM: one.fromM, toM: one.toM, quantity: one.quantity, author: one.author, rejectNote: one.rejectNote, photos: one.photos ?? 0 });
/** A done record Portal sent without its id: listed, never undone. */
const UNNAMED_PREFIX = 'aprobado-';
const fromApproved = (one: WorkMapProgress, index: number): CardBase => ({ id: one.id ?? `${UNNAMED_PREFIX}${one.streetId}-${one.workId}-${index}`, state: 'aprobado', date: one.date, streetId: one.streetId, workId: one.workId, fromM: one.fromM, toM: one.toM, quantity: 0, author: null, rejectNote: null, photos: 0 });

/** What «Deshacer» may take back: the caller's own pending ones, and for an admin every record with an id that counts. */
function undoableOf(bases: CardBase[], list: ByApproveList | null, admin: boolean): Set<string> {
  const own = undoableIds(list);
  if (!admin) return own;
  return new Set([...own, ...bases.filter((base) => base.state !== 'rechazado' && !base.id.startsWith(UNNAMED_PREFIX)).map((base) => base.id)]);
}

/** Newest first; on the same day what Portal keeps pending or was undone goes before the rest. */
export function progressFeedOf(map: Pick<WorkMap, 'streets' | 'works' | 'progress'>, list: ByApproveList | null, today: string, admin = false): FeedCard[] {
  const listed = new Set((list?.items ?? []).map((one) => one.id));
  // The boards fold what Portal keeps pending into the map: each record is listed once.
  const done = map.progress.flatMap((one, index) => (one.id && listed.has(one.id) ? [] : [fromApproved(one, index)]));
  const bases = [...(list?.items ?? []).map(fromByApprove), ...done];
  const undoable = undoableOf(bases, list, admin);
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

/** What the record shows: Portal's count, or the total the tool just answered when it is higher. */
export const feedPhotoCount = (card: Pick<FeedCard, 'id' | 'photos'>, added: Readonly<Record<string, number>>): number =>
  Math.max(card.photos, added[card.id] ?? 0);

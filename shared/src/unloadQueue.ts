import type { RepeatItem, RepeatSection, SectionPath } from './fieldDocument.js';
import type { PhotoToView } from './reportSaves.js';
import type { StateBadge } from './reportCreation.js';
import { dataSectionOf, photoSlotsOf, unitStateOf, unitTitleOf, type UnitSlot } from './reportUnits.js';
import { UNIT_MEASURES } from './unitMeasure.js';

/**
 * The unloading queue of a control de pista (José 20/11, designs pv2-01…pv2-04, spec
 * INFORMES-DESDE-LILACHAT §25): the person decides in the field which truck unloads next. The
 * closed units go first, in Portal's placement order; then the open ones in the order the person
 * set (kept by Lilachat's server, shared between devices); then the ones not here yet. The head
 * of the open ones is the one unloading. A unit is finished only after the one before it left.
 * PURE: the APK and the web draw from here.
 */
export type QueueStatus = 'sent' | 'finished' | 'unloading' | 'queued' | 'onTheWay';
export type QueuedUnit = { item: RepeatItem; status: QueueStatus; position: number; kicker: string | null; plate: string; line: string };
export type FinishBlock = { itemId: string; plate: string; text: string; goLabel: string };
/** What the units view of both platforms takes (designs pv2-01…pv2-04). */
export type UnitsQueueViewProps = {
  section: RepeatSection;
  onOpen: (path: SectionPath) => void;
  onView: (photo: PhotoToView) => void;
  /** «Terminar unidad» (José 19/11): anyone reviews the unit's photos before they go to the group. */
  onAlbum?: (item: RepeatItem) => void;
  admin?: boolean;
  /** José 20/11: the order the channel set; missing, Portal's order of arrival. */
  order?: readonly string[];
  /** The new order of the open units; missing (a published report), nothing moves. */
  onReorder?: (order: string[]) => void;
  /** The unit on the card; the screen holds it so «Ir a PLACA» of the review can pick one. */
  selectedId: string | null;
  onSelect: (itemId: string) => void;
};

export const QUEUE_BADGES: Record<QueueStatus, StateBadge> = {
  sent: { label: 'Enviada', tone: 'ok' },
  finished: { label: 'Terminada', tone: 'ok' },
  unloading: { label: 'Descargando', tone: 'info' },
  queued: { label: 'En cola', tone: 'neutral' },
  onTheWay: { label: 'En camino', tone: 'neutral' },
};
export const QUEUE_TITLE = 'Cola de descarga · orden en campo';
export const QUEUE_HINT = 'Tú decides el orden';
export const UNLOADING_TITLE = 'Descargando ahora';
export const SELECTED_TITLE = 'Unidad seleccionada';
export const MOVE_NEXT_LABEL = 'Siguiente';
export const FINISHED_TITLE = 'Terminadas';
export const ORDER_SAVE_FAILED = 'No se pudo guardar el orden. Revisa tu señal y vuelve a intentarlo.';

const OPEN: readonly QueueStatus[] = ['unloading', 'queued'];
const CLOSED: readonly QueueStatus[] = ['sent', 'finished'];
const SEPARATOR = ' · ';
const FINISHED_LINE = /^termin[óo]\s+(\d{1,2}:\d{2})/i;
const VOLUME = /(\d+(?:[.,]\d+)?)\s*m³/;
const HOUR = /^([01]\d|2[0-3]):[0-5]\d/;
const PLANT_LINE = /^en planta$/i;

export const isOpenStatus = (status: QueueStatus): boolean => OPEN.includes(status);
export const isClosedStatus = (status: QueueStatus): boolean => CLOSED.includes(status);

/** The m³ Portal writes in the unit's plant line, or 0. */
export function volumeOf(item: Pick<RepeatItem, 'summary'>): number {
  const found = item.summary.map((line) => VOLUME.exec(line)?.[1]).find(Boolean);
  return found ? Number(found.replace(',', '.')) : 0;
}

/**
 * When the truck reached the pista: only the hour written in its data. Portal asks for that field
 * («falta hora de llegada»), so the card never claims an arrival the report still lacks (E2E 20/11).
 */
export function arrivedAtOf(item: RepeatItem): string | null {
  const written = dataSectionOf(item)?.values.horaLlegada;
  return typeof written === 'string' && HOUR.test(written) ? written.slice(0, 5) : null;
}

const finishedAtOf = (item: RepeatItem): string | null => item.summary.map((line) => FINISHED_LINE.exec(line)?.[1]).find(Boolean) ?? null;
const volumeText = (item: RepeatItem): string => (volumeOf(item) ? `${String(volumeOf(item)).replace('.', ',')} m³` : '');

function lineOf(item: RepeatItem, status: QueueStatus): string {
  if (status === 'onTheWay') return item.summary.find((line) => PLANT_LINE.test(line.trim())) ?? item.summary.filter((line) => !FINISHED_LINE.test(line)).join(SEPARATOR);
  const arrived = arrivedAtOf(item);
  const finished = isClosedStatus(status) ? finishedAtOf(item) : null;
  return [arrived ? `Llegó ${arrived}` : '', finished ? `Terminó ${finished}` : volumeText(item)].filter(Boolean).join(SEPARATOR);
}

const baseStatusOf = (item: RepeatItem): QueueStatus | 'open' => {
  const state = unitStateOf(item);
  if (state === 'finished') return item.albumSentAt ? 'sent' : 'finished';
  return state === 'working' ? 'open' : 'onTheWay';
};

/** The open units in the person's order; one the order does not name arrived last and goes at the end. */
function inOrder(open: RepeatItem[], order: readonly string[]): RepeatItem[] {
  const rank = (item: RepeatItem) => {
    const at = order.indexOf(item.id);
    return at < 0 ? order.length + open.indexOf(item) : at;
  };
  return [...open].sort((left, right) => rank(left) - rank(right));
}

/** Every unit of the page in the queue's order, with its status and its number in line. */
export function unloadQueueOf(section: Pick<RepeatSection, 'items'>, order: readonly string[] = []): QueuedUnit[] {
  const marked = section.items.map((item) => ({ item, base: baseStatusOf(item) }));
  const closed = marked.filter((one) => one.base === 'sent' || one.base === 'finished');
  const open = inOrder(marked.filter((one) => one.base === 'open').map((one) => one.item), order);
  const away = marked.filter((one) => one.base === 'onTheWay');
  const statuses: { item: RepeatItem; status: QueueStatus }[] = [
    ...closed.map((one) => ({ item: one.item, status: one.base as QueueStatus })),
    ...open.map((item, index) => ({ item, status: (index === 0 ? 'unloading' : 'queued') as QueueStatus })),
    ...away.map((one) => ({ item: one.item, status: 'onTheWay' as QueueStatus })),
  ];
  return statuses.map(({ item, status }, index) => ({ item, status, position: index + 1, ...unitTitleOf(item), line: lineOf(item, status) }));
}

/** The ids of the open units, as the server keeps them. */
export const openOrderOf = (queue: readonly QueuedUnit[]): string[] => queue.filter((one) => isOpenStatus(one.status)).map((one) => one.item.id);

/** A drag on the web: the unit to `to` among the open ones. */
export function moveUnit(order: readonly string[], id: string, to: number): string[] {
  const from = order.indexOf(id);
  if (from < 0) return [...order];
  const rest = order.filter((one) => one !== id);
  const at = Math.max(0, Math.min(to, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/**
 * «Siguiente ↑»: the unit goes to the front of the line, right after the one unloading. The
 * first in line passes the one unloading, so the APK can change it without a drag.
 */
export function moveNext(order: readonly string[], id: string): string[] {
  const from = order.indexOf(id);
  if (from <= 0) return [...order];
  return moveUnit(order, id, from === 1 ? 0 : 1);
}

/** Only an open unit behind the one unloading moves. */
export const canMoveNext = (unit: QueuedUnit): boolean => unit.status === 'queued';

/**
 * José 20/11: a unit is not finished while the one before it in line has not left (no photo of
 * the empty truck). A closed unit only sends its photos again: nothing blocks it.
 */
export function finishBlockOf(queue: readonly QueuedUnit[], itemId: string): FinishBlock | null {
  const at = queue.findIndex((one) => one.item.id === itemId);
  const unit = queue[at];
  const previous = queue[at - 1];
  if (!unit || !previous || !isOpenStatus(unit.status) || !isOpenStatus(previous.status)) return null;
  const name = previous.kicker ? `la ${previous.kicker}${SEPARATOR}${previous.plate}` : previous.plate;
  return { itemId: previous.item.id, plate: previous.plate, text: `Primero termina ${name}: todavía no tiene la foto de unidad vacía.`, goLabel: `Ir a ${previous.plate}` };
}

/** The unit on the card: the one the person picked, else the one unloading, else the first closed. */
export function selectedUnitOf(queue: readonly QueuedUnit[], selectedId: string | null): QueuedUnit | null {
  const picked = selectedId ? queue.find((one) => one.item.id === selectedId && one.status !== 'onTheWay') : undefined;
  return picked ?? queue.find((one) => one.status === 'unloading') ?? queue.find((one) => isClosedStatus(one.status)) ?? null;
}

const count = (queue: readonly QueuedUnit[], status: QueueStatus): number => queue.filter((one) => one.status === status).length;
const plural = (amount: number, one: string, many: string) => `${amount} ${amount === 1 ? one : many}`;

/** «5 unid. · 1 enviada · 1 descargando · 2 en cola · 1 en camino», without the empty ones. */
export function queueCountsLine(queue: readonly QueuedUnit[]): string {
  const parts = [
    queue.length ? `${queue.length} unid.` : '',
    count(queue, 'sent') ? plural(count(queue, 'sent'), 'enviada', 'enviadas') : '',
    count(queue, 'finished') ? plural(count(queue, 'finished'), 'terminada', 'terminadas') : '',
    count(queue, 'unloading') ? '1 descargando' : '',
    count(queue, 'queued') ? `${count(queue, 'queued')} en cola` : '',
    count(queue, 'onTheWay') ? `${count(queue, 'onTheWay')} en camino` : '',
  ];
  return parts.filter(Boolean).join(SEPARATOR);
}

const decimal = (value: number): string => String(Math.round(value * 10) / 10).replace('.', ',');

/** «15 / 75 m³»: what the closed units laid over the whole order; nothing when Portal gives no volume. */
export function queueVolumeLine(queue: readonly QueuedUnit[]): string {
  const total = queue.reduce((sum, one) => sum + volumeOf(one.item), 0);
  if (!total) return '';
  const laid = queue.filter((one) => isClosedStatus(one.status)).reduce((sum, one) => sum + volumeOf(one.item), 0);
  return `${decimal(laid)} / ${decimal(total)} m³`;
}

/** «148 °C» under the temperature slot; nothing when it was not written. */
export function slotMeasureOf(item: RepeatItem, slot: UnitSlot): string | null {
  const measure = UNIT_MEASURES[slot.section.photoKind ?? ''];
  const value = measure ? dataSectionOf(item)?.values[measure.field] : undefined;
  if (!measure || value === undefined || value === null || String(value).trim() === '') return null;
  return `${String(value).replace('.', ',')} ${measure.unit}`;
}

/** The next photo to take, in capture order: «Tomar escantillón». */
export function nextSlotOf(item: RepeatItem): UnitSlot | null {
  return photoSlotsOf(item).find((slot) => !slot.done) ?? null;
}

const PHOTO_WORD = /^(foto\s+(de(l)?\s+)?)/i;

/** «Tomar escantillón», from «Foto de escantillón»; «Unidad vacía · cierra la unidad» → «Tomar unidad vacía». */
export function takeLabelOf(slot: UnitSlot): string {
  const bare = slot.section.title.replace(PHOTO_WORD, '').split(SEPARATOR)[0]!.trim();
  return `Tomar ${bare.charAt(0).toLowerCase()}${bare.slice(1)}`;
}

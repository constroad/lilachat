import { CTL_PIS_EXTRA_PHOTO, MAX_EXTRA_PHOTOS_PER_UNIT } from '@constroad/shared/informes';
import type { FieldDocument, FormSection, RepeatItem, RepeatSection, SectionPath } from './fieldDocument.js';
import { sectionPhotos, type SectionPhoto } from './reportSaves.js';
import type { StateBadge } from './reportCreation.js';

/**
 * The units of a control de pista (José 06/11, designs j-05/j-06): the
 * dispatches that left the plant, each one a volquete to tap when it reaches
 * the pista, in the order it arrives and not the one it left in. Nobody adds
 * a unit; Portal lists them. Four photos per unit, the «vacía» one ends it.
 * PURE: the APK and the web draw from here.
 */
export type UnitState = 'atPlant' | 'waiting' | 'working' | 'finished';
export type UnitSlot = { section: FormSection; photo: SectionPhoto | null; done: boolean };
/** José 06/11, with a pedido of 12: who needs the person first. The order of arrival depends on nothing: `waiting` is a list, no unit is «the next». */
export type UnitGroups = {
  /** On site with something still to do. */
  onSite: RepeatItem[];
  /** Left the plant, not here yet: tap the one that arrives. */
  waiting: RepeatItem[];
  /** Still at the plant: only listed, nothing to tap. */
  atPlant: RepeatItem[];
  /** Done with everything: folded, they no longer need the person. */
  finished: RepeatItem[];
};

const FINISHING_PHOTO = 'vacia';
const TITLE_SEPARATOR = ' · ';
/** «Terminó 10:42» as Portal writes it (`\b` does not see a boundary after «ó»). */
const FINISHED_LINE = /^termin[óo](\s|$)/i;
/** A dispatch that has not left: Portal writes it as a line of its own. */
const PLANT_LINE = /^en planta$/i;

export const ARRIVED_LABEL = 'Llegó';
export const UNIT_GROUP_TITLES: Record<keyof UnitGroups, string> = { onSite: 'En pista', waiting: 'Por llegar · toca el que llegó', atPlant: 'En planta', finished: 'Terminaron' };
export const UNIT_BADGES: Record<Exclude<UnitState, 'finished'>, StateBadge> = { atPlant: { label: 'En planta', tone: 'neutral' }, waiting: { label: 'Por llegar', tone: 'neutral' }, working: { label: 'En pista', tone: 'warn' } };
const FINISHED_BADGE: StateBadge = { label: 'Terminó', tone: 'ok' };

/** A repeat whose items are units: nobody adds one and its template takes photos by kind. */
export const isUnitsRepeat = (section: RepeatSection): boolean => !section.canAdd && section.template.some((entry) => entry.photoKind);

const sectionDone = (section: FormSection): boolean => section.state === 'done' || (Boolean(section.tool) && sectionPhotos(section).length > 0);

/** The photo that ends the unit is done: finished. Anything written: working. Nothing: it left the plant and is not here yet. */
export function unitStateOf(item: RepeatItem): UnitState {
  if (item.summary.some((one) => PLANT_LINE.test(one.trim()))) return 'atPlant';
  if (item.sections.some((one) => one.photoKind === FINISHING_PHOTO && sectionDone(one))) return 'finished';
  return item.sections.some((one) => one.state !== 'empty' || sectionDone(one)) ? 'working' : 'waiting';
}

/** Nothing left to do: every photo taken and its data saved. The «vacía» photo ends the unit, not the report's work on it. */
const isComplete = (item: RepeatItem): boolean => photoSlotsOf(item).every((slot) => slot.done) && dataSectionOf(item)?.state === 'done';

export function unitGroupsOf(section: RepeatSection): UnitGroups {
  const states = section.items.map((item) => ({ item, state: unitStateOf(item) }));
  const of = (state: UnitState) => states.filter((one) => one.state === state).map((one) => one.item);
  const ended = of('finished');
  return { onSite: [...of('working'), ...ended.filter((item) => !isComplete(item))], waiting: of('waiting'), atPlant: of('atPlant'), finished: ended.filter(isComplete) };
}

/** A truck can reach the site before the plant marks it dispatched (José 06/11): its arrival is written all the same. */
const NOT_HERE_YET: readonly UnitState[] = ['waiting', 'atPlant'];

/** From this many units on site their cards push the rows out of sight. */
const STRIP_FROM = 2;

/** The ones on the way as rows, or as a strip of plates on top when the cards on site would bury them: «Llegó» is the next tap. */
export const waitingLayoutOf = (groups: { onSite: readonly unknown[]; waiting: readonly unknown[] }): 'rows' | 'strip' => (groups.waiting.length && groups.onSite.length >= STRIP_FROM ? 'strip' : 'rows');

/** «2 en pista · 6 por llegar · 4 en planta · 1 terminó»: the whole order at a glance, without the empty groups. */
export function unitCountsLine({ onSite, waiting, atPlant, finished }: UnitGroups): string {
  const counts: [number, string][] = [[onSite.length, 'en pista'], [waiting.length, 'por llegar'], [atPlant.length, 'en planta'], [finished.length, finished.length === 1 ? 'terminó' : 'terminaron']];
  return counts.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`).join(' · ');
}

/** «Unidad 3 · QAP-102» is a kicker and a plate; a dispatch not arrived comes as the plate alone. */
export function unitTitleOf(item: Pick<RepeatItem, 'title'>): { kicker: string | null; plate: string } {
  const at = item.title.indexOf(TITLE_SEPARATOR);
  if (at < 0) return { kicker: null, plate: item.title };
  return { kicker: item.title.slice(0, at), plate: item.title.slice(at + TITLE_SEPARATOR.length) };
}

/** The pill of a unit: «Terminó 10:42» as Portal says it, or the state's own word. */
export function unitBadgeOf(item: RepeatItem): StateBadge {
  const state = unitStateOf(item);
  if (state !== 'finished') return UNIT_BADGES[state];
  const line = item.summary.find((one) => FINISHED_LINE.test(one));
  return line ? { ...FINISHED_BADGE, label: line } : FINISHED_BADGE;
}

/** The optional photos of a unit and their cap live with Portal's rules (José 07/11: «muévelo a shared»). */
export const EXTRA_PHOTO_KIND = CTL_PIS_EXTRA_PHOTO;
export const EXTRA_PHOTOS_MAX = MAX_EXTRA_PHOTOS_PER_UNIT;
export type ExtraPhotos = { section: FormSection; photos: SectionPhoto[]; full: boolean };
export const ADD_EXTRA_PHOTO = 'Agregar foto';
/** The strip's title (design j-07b): «Adicionales · opcional (3)». */
export const extraPhotosTitle = (count: number): string => `Adicionales · opcional (${count})`;

/** One slot per fixed photo kind, in the template's order: its last photo, and whether it is done. */
export const photoSlotsOf = (item: RepeatItem): UnitSlot[] => item.sections.filter((one) => one.photoKind && one.photoKind !== EXTRA_PHOTO_KIND).map((section) => ({ section, photo: sectionPhotos(section).at(-1) ?? null, done: sectionDone(section) }));

/** The unit's optional photos under its fixed ones, or null when Portal's template has none. */
export function extraPhotosOf(item: RepeatItem): ExtraPhotos | null {
  const section = item.sections.find((one) => one.photoKind === EXTRA_PHOTO_KIND);
  if (!section) return null;
  const photos = sectionPhotos(section);
  return { section, photos, full: photos.length >= EXTRA_PHOTOS_MAX };
}

/** The section with the unit's data (arrival, temperatures, thickness): the first one that is not a photo. */
export const dataSectionOf = (item: RepeatItem): FormSection | undefined => item.sections.find((one) => !one.tool);

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/** The hour of the device's clock, as a form's time field holds it. */
export function clockHourOf(now: string): string {
  const at = new Date(now);
  return `${twoDigits(at.getHours())}:${twoDigits(at.getMinutes())}`;
}

/**
 * «Llegó» is the moment of the tap (E2E 06/11), and the document on the phone
 * can be hours old: the hour comes from its clock. Portal only sends the hour a
 * driver marked, which stays. Undefined for anything but a unit not here yet.
 */
export function arrivalHourOf(document: FieldDocument, path: SectionPath, now: string): string | undefined {
  const repeat = document.sections.find((one) => one.id === path.sectionId);
  if (repeat?.kind !== 'repeat' || !isUnitsRepeat(repeat)) return undefined;
  const item = repeat.items.find((one) => one.id === path.itemId);
  if (!item || dataSectionOf(item)?.id !== path.key) return undefined;
  return NOT_HERE_YET.includes(unitStateOf(item)) ? clockHourOf(now) : photoArrivalOf(item, now);
}

/** A photo's hour as Portal stamps it. */
const PHOTO_HOUR = /^([01]\d|2[0-3]):[0-5]\d/;

/** The data opened after the ingreso photo: the truck arrived when that photo was taken, or now if it is still on the phone. */
function photoArrivalOf(item: RepeatItem, now: string): string | undefined {
  const [ingreso] = photoSlotsOf(item);
  if (dataSectionOf(item)?.state !== 'empty' || !ingreso?.done) return undefined;
  return ingreso.photo?.hour.match(PHOTO_HOUR)?.[0] ?? clockHourOf(now);
}

/** José 07/11: «primero tomar la foto de ingreso». «Llegó» opens the first photo; the data comes after. */
export const arrivalKeyOf = (item: RepeatItem): string | undefined => photoSlotsOf(item)[0]?.section.id ?? dataSectionOf(item)?.id;

/** What the summary of a unit says beside its plate, without the «Terminó» line the pill already shows. */
export const unitLineOf = (item: RepeatItem): string => item.summary.filter((one) => !FINISHED_LINE.test(one)).join(TITLE_SEPARATOR);

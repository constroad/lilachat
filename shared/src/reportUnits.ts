import type { FormSection, RepeatItem, RepeatSection } from './fieldDocument.js';
import { sectionPhotos, type SectionPhoto } from './reportSaves.js';
import type { StateBadge } from './reportCreation.js';

/**
 * The units of a control de pista (José 06/11, designs j-05/j-06): the
 * dispatches that left the plant, each one a volquete to tap when it reaches
 * the pista, in the order it arrives and not the one it left in. Nobody adds
 * a unit; Portal lists them. Four photos per unit, the «vacía» one ends it.
 * PURE: the APK and the web draw from here.
 */
export type UnitState = 'waiting' | 'working' | 'finished';
export type UnitSlot = { section: FormSection; photo: SectionPhoto | null; done: boolean };
export type UnitGroups = { /** Left the plant, not here yet: tap the one that arrives. */ waiting: RepeatItem[]; /** On site, by arrival: the ones still working first, then the finished. */ arrived: RepeatItem[] };

const FINISHING_PHOTO = 'vacia';
const TITLE_SEPARATOR = ' · ';
/** «Terminó 10:42» as Portal writes it (`\b` does not see a boundary after «ó»). */
const FINISHED_LINE = /^termin[óo](\s|$)/i;

export const ARRIVED_LABEL = 'Llegó';
export const UNIT_GROUP_TITLES: Record<keyof UnitGroups, string> = { waiting: 'Salieron de planta · toca la que llega', arrived: 'En obra · por orden de llegada' };
export const UNIT_BADGES: Record<Exclude<UnitState, 'finished'>, StateBadge> = { waiting: { label: 'Por llegar', tone: 'neutral' }, working: { label: 'En pista', tone: 'warn' } };
const FINISHED_BADGE: StateBadge = { label: 'Terminó', tone: 'ok' };

/** A repeat whose items are units: nobody adds one and its template takes photos by kind. */
export const isUnitsRepeat = (section: RepeatSection): boolean => !section.canAdd && section.template.some((entry) => entry.photoKind);

const sectionDone = (section: FormSection): boolean => section.state === 'done' || (Boolean(section.tool) && sectionPhotos(section).length > 0);

/** The photo that ends the unit is done: finished. Anything written: working. Nothing: it left the plant and is not here yet. */
export function unitStateOf(item: RepeatItem): UnitState {
  if (item.sections.some((one) => one.photoKind === FINISHING_PHOTO && sectionDone(one))) return 'finished';
  return item.sections.some((one) => one.state !== 'empty') ? 'working' : 'waiting';
}

export function unitGroupsOf(section: RepeatSection): UnitGroups {
  const states = section.items.map((item) => ({ item, state: unitStateOf(item) }));
  const of = (state: UnitState) => states.filter((one) => one.state === state).map((one) => one.item);
  return { waiting: of('waiting'), arrived: [...of('working'), ...of('finished')] };
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

/** One slot per photo kind, in the template's order: its last photo, and whether it is done. */
export const photoSlotsOf = (item: RepeatItem): UnitSlot[] => item.sections.filter((one) => one.photoKind).map((section) => ({ section, photo: sectionPhotos(section).at(-1) ?? null, done: sectionDone(section) }));

/** The section with the unit's data (arrival, temperatures, escantillón): the first one that is not a photo. */
export const dataSectionOf = (item: RepeatItem): FormSection | undefined => item.sections.find((one) => !one.tool);

/** What the summary of a unit says beside its plate, without the «Terminó» line the pill already shows. */
export const unitLineOf = (item: RepeatItem): string => item.summary.filter((one) => !FINISHED_LINE.test(one)).join(TITLE_SEPARATOR);

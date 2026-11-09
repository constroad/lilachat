import { ALL_DAYS, dayColorsOf, dayLabel, dischargeDayOf, limaDayOf, mediaDaysOf, unitNumbersOf } from '@constroad/shared/obra';
import { sharedDischargeOf, type UnitDischarge } from './workMapDischarges.js';
import type { MapPhoto, PhotoSpot } from './workMapPhotos.js';
import { dischargePinsOf, type DischargePin } from './workMapProgress.js';
import { photoSpotPins } from './workMapPhotos.js';
import type { DischargeSuggestion } from './workMapDischarges.js';

/**
 * A work done over several days (José 09/11, Globofast): the map offers «Todos» or ONE day of
 * placement, a unit is numbered inside its day and each day has its color. The rules are Portal's,
 * in `@constroad/shared/obra` (v0.16.0); this only changes Lilachat's shapes.
 */
export { ALL_DAYS };
/** `color`: the day's color on the map, for its chip; «Todos» has none. */
export type MapDayOption = { key: string; label: string; color?: string };

const daysOf = (photos: readonly MapPhoto[], units: readonly UnitDischarge[]) => mediaDaysOf(photos, units.map(sharedDischargeOf));

/** Nothing to pick with one day or none; otherwise «Todos» and each day, newest first. */
export function mapDayOptions(photos: readonly MapPhoto[], units: readonly UnitDischarge[]): MapDayOption[] {
  const days = daysOf(photos, units);
  if (days.length < 2) return [];
  const colors = dayColorsOf(days);
  return [{ key: ALL_DAYS, label: 'Todos' }, ...days.map((day) => ({ key: day, label: dayLabel(day), color: colors.get(day) }))];
}

/** The day of each unit, by its dispatch. */
export const unitDays = (units: readonly UnitDischarge[]): Map<string, string> =>
  new Map(units.flatMap((one) => { const day = dischargeDayOf(sharedDischargeOf(one)); return day ? [[one.dispatchId, day] as const] : []; }));

/** «Todos» keeps everything; a day keeps what happened that day in Lima. */
export function mediaOfDay<Photo extends MapPhoto>(photos: Photo[], units: UnitDischarge[], day: string): { photos: Photo[]; units: UnitDischarge[] } {
  if (day === ALL_DAYS) return { photos, units };
  const days = unitDays(units);
  return { photos: photos.filter((one) => limaDayOf(one.at) === day), units: units.filter((one) => days.get(one.dispatchId) === day) };
}

/** Each unit's number inside its own day: every day starts again at 1. */
export const unitNumbers = (units: readonly UnitDischarge[]): Map<string, number> => unitNumbersOf(units.map(sharedDischargeOf));

/** The color of each pin's day, only when the work has several days. `dayOf` maps a pin id to its day. */
export function withDayColors(pins: DischargePin[], dayOf: ReadonlyMap<string, string>, days: readonly string[]): DischargePin[] {
  if (days.length < 2) return pins;
  const colors = dayColorsOf(days);
  return pins.map((pin) => { const color = colors.get(dayOf.get(pin.id) ?? ''); return color ? { ...pin, dayColor: color } : pin; });
}

/** The day of each photo marker: the day of its newest photo (Portal's rule). */
export const photoSpotDays = (spots: readonly PhotoSpot[]): Map<string, string> =>
  new Map(spots.flatMap((spot) => { const day = limaDayOf(spot.photos[0]?.at); return day ? [[`fotos-${spot.id}`, day] as const] : []; }));

/** The days of the map, newest first. */
export const mapDays = daysOf;

/** The units of the chosen day, numbered inside their day and ringed with its color. */
export function unitPinsOfDay(suggestion: Pick<DischargeSuggestion, 'units' | 'hasWork'>, units: readonly UnitDischarge[], day: string, days: readonly string[]): DischargePin[] {
  const dayOf = unitDays(units);
  const pins = dischargePinsOf(suggestion, unitNumbers(units)).filter((pin) => day === ALL_DAYS || dayOf.get(pin.id) === day);
  return withDayColors(pins, dayOf, days);
}

/** The photo markers filled with their day's color; one off the work keeps its red. */
export const photoPinsOfDay = (spots: readonly PhotoSpot[], days: readonly string[]): DischargePin[] =>
  withDayColors(photoSpotPins([...spots]), photoSpotDays(spots), days);

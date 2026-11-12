import { projectToLine, stationLabel } from '@constroad/shared/obra';
import type { ChoiceOption } from './appFormOptions.js';
import type { AppForm, FormField, FormValues, GeoPoint, GpsRole } from './appForms.js';
import type { WorkMapStreet } from './workMap.js';

/**
 * The fields the field engineer never types (José 12/11, CON-CAP: take work off the engineer, never add
 * it). Portal marks them in the form: `gps` numbers are the device's reading, `work-street` a
 * street of the service's work map, `work-station` the station on it. The reading picks the nearest
 * street and projects the point on it; the engineer can still change both. PURE: the APK and the web.
 */

/** Beyond this the reading is «approximate» (agreed with Portal 12/11); the point is saved anyway. */
export const PRECISE_ENOUGH_M = 15;
/** A street farther than this from the reading is not the one the engineer stands on. */
export const STREET_REACH_M = 40;
const COORDINATE_DECIMALS = 7;

export type GpsGroup = { lat: string; lng: string; precision?: string };

/** The form's lat, lng and precision fields; without lat and lng there is no reading to write. */
export function gpsGroupOf(fields: readonly FormField[]): GpsGroup | null {
  const nameOf = (role: GpsRole) => fields.find((field) => field.kind === 'number' && field.gps === role)?.name;
  const [lat, lng, precision] = [nameOf('lat'), nameOf('lng'), nameOf('precision')];
  return lat && lng ? { lat, lng, ...(precision ? { precision } : {}) } : null;
}

/** The numbers a reading writes: seven decimals (about a centimeter) and whole meters. */
export function gpsValuesOf(group: GpsGroup, reading: GeoPoint): FormValues {
  const round = (value: number) => Number(value.toFixed(COORDINATE_DECIMALS));
  return { [group.lat]: round(reading.lat), [group.lng]: round(reading.lng), ...(group.precision ? { [group.precision]: Math.round(reading.precision) } : {}) };
}

const numberOf = (value: unknown): number | null => {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};

/** The reading the form holds, also when a refused form came back with text; null when there is none. */
export function readingOf(group: GpsGroup, values: FormValues): GeoPoint | null {
  const [lat, lng] = [numberOf(values[group.lat]), numberOf(values[group.lng])];
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, precision: (group.precision ? numberOf(values[group.precision]) : null) ?? 0 };
}

export type PrecisionNote = { tone: 'ok' | 'warn'; text: string };
export function precisionNoteOf(precisionM: number | undefined): PrecisionNote {
  if (precisionM === undefined || !Number.isFinite(precisionM)) return { tone: 'warn', text: 'Sin precisión del GPS.' };
  const meters = Math.round(precisionM);
  if (precisionM <= PRECISE_ENOUGH_M) return { tone: 'ok', text: `Precisión ± ${meters} m` };
  return { tone: 'warn', text: `Ubicación aproximada (± ${meters} m). Espera unos segundos y vuelve a tomarla.` };
}

export type NearStreet = { id: string; name: string; distanceM: number; measureM: number };

const projectionOn = (street: WorkMapStreet, point: GeoPoint) => (street.line.length >= 2 ? projectToLine(street.line, point) : null);

/** The street the engineer stands on: the nearest within reach, and how far along it the point is. */
export function nearestStreet(streets: readonly WorkMapStreet[], point: GeoPoint, reach = STREET_REACH_M): NearStreet | null {
  let best: NearStreet | null = null;
  for (const street of streets) {
    const at = projectionOn(street, point);
    if (at && at.distanceM <= reach && (!best || at.distanceM < best.distanceM)) best = { id: street.id, name: street.name, distanceM: at.distanceM, measureM: at.measureM };
  }
  return best;
}

export type WorkFields = { street?: string; station?: string };
export function workFieldsOf(fields: readonly FormField[]): WorkFields {
  const street = fields.find((field) => field.kind === 'text' && field.street)?.name;
  const station = fields.find((field) => field.kind === 'text' && field.station)?.name;
  return { ...(street ? { street } : {}), ...(station ? { station } : {}) };
}

const isBlank = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && !value.trim());

export type AutofillInput = {
  fields: readonly FormField[];
  values: FormValues;
  streets: readonly WorkMapStreet[];
  reading: GeoPoint;
  /** What Lilachat wrote last: a field still holding it may follow a new pick; anything else is the engineer's. */
  written: FormValues;
};

/** What the reading fills on its own; never over what the engineer chose or typed. */
export function placeAutofill({ fields, values, streets, reading, written }: AutofillInput): FormValues {
  const { street, station } = workFieldsOf(fields);
  const ours = (name: string) => isBlank(values[name]) || values[name] === written[name];
  const patch: FormValues = {};
  const near = nearestStreet(streets, reading);
  if (street && near && ours(street) && values[street] !== near.id) patch[street] = near.id;
  if (!station || !ours(station)) return patch;
  const chosen = street ? String(patch[street] ?? values[street] ?? '') : near?.id;
  const on = streets.find((candidate) => candidate.id === chosen);
  const at = on ? projectionOn(on, reading) : null;
  // Far from the chosen street a station means nothing: Lilachat's own is cleared, never left wrong.
  const label = at && at.distanceM <= STREET_REACH_M ? stationLabel(at.measureM) : '';
  if (label !== (values[station] ?? '')) patch[station] = label;
  return patch;
}

/** The streets to pick from; with a reading, the nearest first and how far each one is. */
export function streetOptionsOf(streets: readonly WorkMapStreet[], reading: GeoPoint | null): ChoiceOption[] {
  const named = (street: WorkMapStreet) => street.name.trim() || 'Calle sin nombre';
  if (!reading) return streets.map((street) => ({ value: street.id, label: named(street) }));
  const measured = streets.map((street) => ({ street, distanceM: projectionOn(street, reading)?.distanceM ?? Number.POSITIVE_INFINITY }));
  measured.sort((first, second) => first.distanceM - second.distanceM);
  return measured.map(({ street, distanceM }) => ({ value: street.id, label: named(street), ...(Number.isFinite(distanceM) ? { sub: `a ${Math.round(distanceM)} m` } : {}) }));
}

const WORK_INPUTS = ['work-street', 'work-station'];
/** A form that picks a street of the work map: only then is the map asked for (one request through Portal). */
export const wantsWorkStreets = (form: AppForm | undefined): boolean => Object.values(form?.schema.properties ?? {}).some((property) => WORK_INPUTS.includes(String(property['x-input'])));

import type { FormField, FormValues } from './appForms.js';

/**
 * The conditions of the work a field report asks for and the phone already knows (José 12/11, CTL-PIS
 * «Información de control»): the shift by the hour, the weather where the engineer stands and the
 * street under the GPS. They are suggestions: only an empty field is written, and the person edits it.
 */
export type ConditionRole = 'shift' | 'weather' | 'street';
/** What the server says of a reading: the street and the weather in words; null when it did not arrive. */
export type FieldConditions = { street: string | null; weather: string | null };

/** Portal's names in its report forms, while they carry no `x-input` (an older Lilachat refuses one it does not know). */
const ROLE_BY_NAME: Record<string, ConditionRole> = { turno: 'shift', clima: 'weather', tramo: 'street' };
const MORNING_FROM = 5;
const AFTERNOON_FROM = 12;
const NIGHT_FROM = 18;

/** The fields to fill and what goes in each, by the app's `x-input` or by Portal's name. */
export function conditionKindsOf(fields: readonly FormField[]): Record<string, ConditionRole> {
  const kinds: Record<string, ConditionRole> = {};
  for (const field of fields) {
    if (field.kind !== 'text' && field.kind !== 'choice') continue;
    const role = field.condition ?? ROLE_BY_NAME[field.name];
    if (role) kinds[field.name] = role;
  }
  return kinds;
}

/** «Mañana» from 5, «Tarde» from 12, «Noche» from 18: the phone's own hour. */
export function shiftOf(at: Date): string {
  const hour = at.getHours();
  if (hour >= MORNING_FROM && hour < AFTERNOON_FROM) return 'Mañana';
  return hour >= AFTERNOON_FROM && hour < NIGHT_FROM ? 'Tarde' : 'Noche';
}

/** The WMO weather codes Open-Meteo answers, in words an engineer writes. */
const SKY: ReadonlyArray<[readonly number[], string]> = [
  [[0], 'Despejado'],
  [[1, 2], 'Parcialmente nublado'],
  [[3], 'Nublado'],
  [[45, 48], 'Neblina'],
  [[51, 53, 55, 56, 57], 'Llovizna'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Lluvia'],
  [[71, 73, 75, 77, 85, 86], 'Nieve'],
  [[95, 96, 99], 'Tormenta'],
];

/** «Nublado · 18 °C»; an unknown code says only the temperature. */
export function weatherLabelOf(code: number, temperatureC?: number): string {
  const sky = SKY.find(([codes]) => codes.includes(code))?.[1];
  const degrees = temperatureC === undefined || !Number.isFinite(temperatureC) ? null : `${Math.round(temperatureC)} °C`;
  return [sky, degrees].filter(Boolean).join(' · ');
}

const normalize = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === '';

/** A choice takes the option whose label or value starts the way the suggestion does; a text takes it whole. */
function valueFor(field: FormField, suggestion: string): string | null {
  if (field.kind !== 'choice') return suggestion;
  const wanted = normalize(suggestion.split(' · ')[0] ?? suggestion);
  const option = field.options.find((one) => normalize(one.label) === wanted || normalize(one.value) === wanted || wanted.startsWith(normalize(one.label)));
  return option ? option.value : null;
}

/** What to write now in the empty fields: the shift always, the street and the weather once the server answered. PURE. */
export function conditionValues(fields: readonly FormField[], values: FormValues, input: { now: Date; conditions: FieldConditions | null }): FormValues {
  const kinds = conditionKindsOf(fields);
  const known: Record<ConditionRole, string | null> = { shift: shiftOf(input.now), weather: input.conditions?.weather ?? null, street: input.conditions?.street ?? null };
  const filled: FormValues = {};
  for (const field of fields) {
    const role = kinds[field.name];
    const suggestion = role ? known[role] : null;
    if (!suggestion || !isEmpty(values[field.name])) continue;
    const value = valueFor(field, suggestion);
    if (value) filled[field.name] = value;
  }
  return filled;
}

/** Whether the form asks for something only the reading gives: then the phone is asked where it is. */
export const needsReading = (fields: readonly FormField[], values: FormValues): boolean =>
  Object.entries(conditionKindsOf(fields)).some(([name, role]) => role !== 'shift' && isEmpty(values[name]));

type FillRun = {
  fields: readonly FormField[];
  /** The values now: what the person typed meanwhile wins. */
  current: () => FormValues;
  fill: (next: FormValues) => void;
  /** Where the phone is; nothing when it does not say. */
  locate: () => Promise<{ lat?: number; lng?: number }>;
  ask: (point: { lat: number; lng: number; precision: number }) => Promise<FieldConditions | null>;
  /** False once the form closed: nothing is written after. */
  open: () => boolean;
};

/** The shift at once, then the street and the weather of the reading: the APK's and the web's hooks run this. */
export async function fillConditions(run: FillRun): Promise<void> {
  if (Object.keys(conditionKindsOf(run.fields)).length === 0) return;
  const now = new Date();
  const atOnce = conditionValues(run.fields, run.current(), { now, conditions: null });
  if (Object.keys(atOnce).length) run.fill(atOnce);
  if (!needsReading(run.fields, run.current())) return;
  const place = await run.locate();
  if (!run.open() || place.lat === undefined || place.lng === undefined) return;
  const conditions = await run.ask({ lat: place.lat, lng: place.lng, precision: 0 });
  if (!run.open() || !conditions) return;
  const arrived = conditionValues(run.fields, { ...run.current(), ...atOnce }, { now, conditions });
  if (Object.keys(arrived).length) run.fill(arrived);
}

type LatestForm = { current: { fields: readonly FormField[]; values: FormValues; fill: (next: FormValues) => void; ask?: FillRun['ask'] } };

/** The effect of both sides' hook: runs `fillConditions` for the form now open, and the cleanup stops it. */
export function subscribeConditionsFill(latest: LatestForm, locate: FillRun['locate']): () => void {
  let open = true;
  const ask = latest.current.ask;
  if (ask) void fillConditions({ fields: latest.current.fields, current: () => latest.current.values, fill: (next) => latest.current.fill(next), locate, ask, open: () => open });
  return () => {
    open = false;
  };
}

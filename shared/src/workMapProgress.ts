import { metersLabel, sliceLine, stationLabel, type WorkMap, type WorkMapLine, type WorkMapWork } from './workMap.js';
import type { DischargePoint, DischargeSuggestion, PlacedDischarge, SuggestedStretch, UnitDischarge } from './workMapDischarges.js';

/**
 * From Portal's units to the progress the person confirms (design `o-07`, contract of 07/11).
 * Reads `discharges` of the service detail by a whitelist, and fills `registrar_avance_de_obra`.
 * The date is not sent: Portal takes the day the units worked from their photos. PURE.
 */
export const PROGRESS_SHORTCUT = 'registrar_avance_de_obra';
export const NO_PLATE = 'Sin placa';
const UNITS_MAX = 100;
const POINTS_MAX = 20;
const ENTRY_UNITS_MAX = 30;
const NOTE_MAX = 280;
const ID_MAX = 64;
const LAT_MAX = 90;
const LNG_MAX = 180;
/** MapLibre paints plain colors: the suggested stretch in the accent of the design. */
const STRETCH_COLOR = '#7c3aed';

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null);
const number = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const isoOf = (value: unknown): string | null => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null);

function pointOf(value: unknown): DischargePoint[] {
  const raw = record(value);
  const [lat, lng, at] = [number(raw?.lat), number(raw?.lng), isoOf(raw?.at)];
  if (!raw || lat === null || lng === null || !at || Math.abs(lat) > LAT_MAX || Math.abs(lng) > LNG_MAX) return [];
  const precisionM = number(raw.precision_m);
  return [{ kind: typeof raw.kind === 'string' ? raw.kind : '', lat, lng, ...(precisionM !== null && precisionM >= 0 ? { precisionM } : {}), at }];
}

function unitOf(value: unknown): UnitDischarge[] {
  const raw = record(value);
  const dispatchId = typeof raw?.dispatch_id === 'string' ? raw.dispatch_id.trim().slice(0, ID_MAX) : '';
  if (!raw || !dispatchId) return [];
  const plate = typeof raw.plate === 'string' && raw.plate.trim() ? raw.plate.trim() : NO_PLATE;
  const m3 = number(raw.m3);
  const points = (Array.isArray(raw.points) ? raw.points : []).flatMap(pointOf).slice(0, POINTS_MAX);
  return [{ dispatchId, plate, m3: m3 !== null && m3 >= 0 ? m3 : null, arrivalAt: isoOf(raw.arrival_at), points }];
}

/** `discharges` of the service detail; Portal leaves the key out when no unit has a placed photo. */
export const dischargesOf = (value: unknown): UnitDischarge[] => (Array.isArray(value) ? value.flatMap(unitOf).slice(0, UNITS_MAX) : []);

export type ProgressEntry = {
  servicioId: string;
  calleId: string;
  etiquetaId?: string;
  partidaId?: string;
  desdeM: number;
  hastaM: number;
  despachoIds: string[];
  /** The device's UUID: a resend after a lost answer is the same entry, and Portal says `ya_marcada`. */
  entradaId: string;
  /** Only for the audit: the date comes from the photos. */
  horaDelEquipo: string;
  nota?: string;
};
export type ProgressDraft = {
  serviceId: string;
  stretch: SuggestedStretch;
  fromM: number;
  toM: number;
  work: WorkMapWork | undefined;
  entryId: string;
  now: Date;
  streetLengthM: number;
  note?: string;
};

/** Portal refuses an end past the street's length plus half a meter (Portal 07/11). */
const END_TOLERANCE_M = 0.5;

/** Whole meters, as Portal stores them; an end within the street never rounds past what Portal accepts. */
function endOf(toM: number, streetLengthM: number): number {
  const limit = streetLengthM + END_TOLERANCE_M;
  return toM <= limit ? Math.min(Math.round(toM), Math.floor(limit)) : Math.round(toM);
}

function refusalOf(draft: ProgressDraft, fromM: number, toM: number): string | null {
  if (!draft.work) return 'Elige el trabajo que se hizo en el tramo.';
  if (toM <= fromM) return 'El final del tramo tiene que ir después del inicio.';
  if (fromM < 0 || toM > draft.streetLengthM + END_TOLERANCE_M) return `El tramo pasa el largo de la calle (${metersLabel(draft.streetLengthM)}).`;
  if (draft.stretch.dispatchIds.length === 0) return 'Este tramo no tiene unidades que lo respalden.';
  if (draft.stretch.dispatchIds.length > ENTRY_UNITS_MAX) return `Máximo ${ENTRY_UNITS_MAX} unidades por avance.`;
  return null;
}

export function progressEntryOf(draft: ProgressDraft): { ok: true; entry: ProgressEntry } | { ok: false; message: string } {
  const [fromM, toM] = [Math.round(draft.fromM), endOf(draft.toM, draft.streetLengthM)];
  const refusal = refusalOf(draft, fromM, toM);
  if (refusal || !draft.work) return { ok: false, message: refusal ?? '' };
  const note = draft.note?.trim().slice(0, NOTE_MAX);
  return { ok: true, entry: {
    servicioId: draft.serviceId,
    calleId: draft.stretch.streetId,
    ...(draft.work.partida ? { partidaId: draft.work.id } : { etiquetaId: draft.work.id }),
    desdeM: fromM,
    hastaM: toM,
    despachoIds: [...draft.stretch.dispatchIds],
    entradaId: draft.entryId,
    horaDelEquipo: draft.now.toISOString(),
    ...(note ? { nota: note } : {}),
  } };
}

/** Peru keeps -05:00 all year: the hour a person on site read. */
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const HOUR_START = 11;
const HOUR_END = 16;
const hourInLima = (iso: string) => new Date(Date.parse(iso) - LIMA_OFFSET_MS).toISOString().slice(HOUR_START, HOUR_END);
const volumeLabel = (m3: number) => `${String(m3).replace('.', ',')} m³`;

/** `loose`: the service has no street yet, so a unit is not «outside» anything (Portal via José 09/11). */
export type DischargeRow = { dispatchId: string; number: number; title: string; line: string; state: PlacedDischarge['state'] | 'loose' };

function placeOf(placed: PlacedDischarge, hasWork: boolean): string {
  if (placed.state === 'placed') return `${stationLabel(placed.fromM)} a ${stationLabel(placed.toM)}`;
  if (placed.state === 'outside') return hasWork ? 'Fuera de la obra' : 'Sin calles dibujadas';
  return 'Sin lugar en sus fotos';
}

/** The units as design o-07 lists them, in the order they arrived. */
/** `numbers`: each unit's number inside its day, as the map's pins say it (José 09/11). */
export const dischargeRowsOf = ({ units, hasWork }: Pick<DischargeSuggestion, 'units' | 'hasWork'>, numbers?: ReadonlyMap<string, number>): DischargeRow[] =>
  units.map((placed, index) => {
    const { unit } = placed;
    const number = numbers?.get(unit.dispatchId) ?? index + 1;
    const parts = [unit.arrivalAt ? hourInLima(unit.arrivalAt) : null, unit.m3 === null ? null : volumeLabel(unit.m3), placeOf(placed, hasWork !== false)];
    const state = placed.state === 'outside' && hasWork === false ? 'loose' : placed.state;
    return { dispatchId: unit.dispatchId, number, title: `Unidad ${number} · ${unit.plate}`, line: parts.filter(Boolean).join(' · '), state };
  });

/** The works planned on a street: the progress of the stretch is one of them. */
export const stretchWorksOf = (map: Pick<WorkMap, 'scopes' | 'works'>, streetId: string): WorkMapWork[] => {
  const ids = new Set(map.scopes.filter((scope) => scope.streetId === streetId).flatMap((scope) => scope.workIds));
  return map.works.filter((work) => ids.has(work.id));
};

/**
 * A pin over the map. A unit of the Control de pista carries its number and its plate under it
 * (José 09/11: «así sabremos qué unidad estuvo en cierto lugar»); a spot of the «Fotos» layer
 * carries a camera or a film and how many it holds, never a bare number.
 */
export type DischargePin = { id: string; label: string; lat: number; lng: number; outside: boolean; caption?: string; icon?: 'photo' | 'video'; /** The color of its day when the work has several (José 09/11): a photo is filled with it, a unit wears it as a ring. */ dayColor?: string; /** Its own fill: an observation is red while pending and green once lifted (design `ob-01`). */ fill?: string };

/** A numbered pin where each unit emptied; the one outside the work stands apart. */
export const dischargePinsOf = ({ units, hasWork }: Pick<DischargeSuggestion, 'units' | 'hasWork'>, numbers?: ReadonlyMap<string, number>): DischargePin[] =>
  units.flatMap((placed, index) => {
    const spot = placed.state === 'outside' ? placed.point : placed.unit.points.at(-1);
    return spot ? [{ id: placed.unit.dispatchId, label: String(numbers?.get(placed.unit.dispatchId) ?? index + 1), lat: spot.lat, lng: spot.lng, outside: placed.state === 'outside' && hasWork !== false, ...(placed.unit.plate ? { caption: placed.unit.plate } : {}) }] : [];
  });

/** The stretch about to be confirmed, as a line the canvas draws over the street. */
export function stretchLineOf(map: Pick<WorkMap, 'streets'>, streetId: string, fromM: number, toM: number): WorkMapLine | null {
  const street = map.streets.find((one) => one.id === streetId);
  const coordinates = street ? sliceLine(street.line, fromM, toM).map((point): [number, number] => [point.lng, point.lat]) : [];
  return coordinates.length >= 2 ? { streetId, color: STRETCH_COLOR, coordinates, fromM, toM } : null;
}

/** MapLibre paints plain colors: a unit outside the work in red. */
const OUTSIDE_COLOR = '#dc2626';

/** The numbered pins as a MapLibre source: the APK draws a circle, its number and the plate; icon pins go as views. */
export const dischargePinCollection = (pins: DischargePin[]) => ({
  type: 'FeatureCollection' as const,
  features: pins.filter((pin) => !pin.icon).map((pin) => ({ type: 'Feature' as const, properties: { id: pin.id, label: pin.label, caption: pin.caption ?? '', color: pin.fill ?? (pin.outside ? OUTSIDE_COLOR : STRETCH_COLOR), ring: pin.dayColor ?? '#ffffff', ringWidth: pin.dayColor ? 4 : 2 }, geometry: { type: 'Point' as const, coordinates: [pin.lng, pin.lat] as [number, number] } })),
});

export type StretchRange = { fromM: number; toM: number };

/** Every suggested stretch over its street, with the range the person adjusted when there is one. */
export const stretchLinesOf = (map: Pick<WorkMap, 'streets'>, stretches: SuggestedStretch[], ranges: Record<string, StretchRange>): WorkMapLine[] =>
  stretches.flatMap((stretch) => {
    const range = ranges[stretch.streetId] ?? stretch;
    const line = stretchLineOf(map, stretch.streetId, range.fromM, range.toM);
    return line ? [line] : [];
  });

/** «Ancho útil» on the runway control card (o-07): the width Portal multiplies by, and the area it gives. */
export function usefulWidthLabel(map: Pick<WorkMap, 'streets' | 'scopes'>, streetId: string, range: StretchRange): string {
  const scope = map.scopes.find((one) => one.streetId === streetId && one.fromM <= range.fromM && range.fromM < one.toM);
  const widthM = scope?.widthM ?? map.streets.find((street) => street.id === streetId)?.widthM;
  if (!widthM) return 'Sin ancho: cárgalo en Portal';
  const areaM2 = Math.round(Math.max(0, range.toM - range.fromM) * widthM);
  return `${widthM.toFixed(1).replace('.', ',')} m · ${metersLabel(areaM2).replace(/ m$/, '')} m²`;
}

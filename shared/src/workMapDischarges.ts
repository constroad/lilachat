import { metersLabel, projectOntoLine, type WorkMap, type WorkMapPoint, type WorkMapStreet } from './workMap.js';

/**
 * From the Control de pista to the map (design o-07): the photos of a unit carry
 * the place they were taken, and their projection on a street is the stretch
 * that unit worked. It is a suggestion: the person confirms it or corrects it.
 * PURE: the APK and the web draw from here.
 */
export type DischargePoint = WorkMapPoint & { kind: string; precisionM?: number; at: string };
export type UnitDischarge = {
  dispatchId: string;
  plate: string;
  m3: number | null;
  arrivalAt: string | null;
  points: DischargePoint[];
};
export type PlacedDischarge =
  | { state: 'placed'; unit: UnitDischarge; streetId: string; fromM: number; toM: number }
  | { state: 'outside'; unit: UnitDischarge; point: WorkMapPoint }
  | { state: 'noPlace'; unit: UnitDischarge };
export type SuggestedStretch = {
  streetId: string;
  streetName: string;
  fromM: number;
  toM: number;
  lengthM: number;
  volumeM3: number;
  units: number;
};
export type DischargeSuggestion = { units: PlacedDischarge[]; stretches: SuggestedStretch[] };

type StreetFit = { street: WorkMapStreet; measures: number[]; offsetM: number };
type Placed = Extract<PlacedDischarge, { state: 'placed' }>;

/** Farther than this from the axis is not that street: Portal's search radius and a sidewalk. */
const STREET_REACH_M = 30;
/** A fix worse than this does not tell one stretch from the next. */
const WORST_PRECISION_M = 30;
const NO_ARRIVAL = '9999';
const VOLUME_ROUNDING = 100;

const trusted = (point: DischargePoint) => (point.precisionM ?? 0) <= WORST_PRECISION_M;

function fitOn(street: WorkMapStreet, points: DischargePoint[]): StreetFit | null {
  const feet = points.flatMap((point) => {
    const foot = projectOntoLine(street.line, point);
    return foot && foot.distanceM <= STREET_REACH_M ? [foot] : [];
  });
  if (feet.length === 0) return null;
  const offsetM = feet.reduce((total, foot) => total + foot.distanceM, 0);
  return { street, measures: feet.map((foot) => Math.min(foot.measureM, street.lengthM)), offsetM };
}

/** The street that holds the most photos of the unit and, between equals, the closest one. */
function bestFit(streets: WorkMapStreet[], points: DischargePoint[]): StreetFit | null {
  const fits = streets.flatMap((street) => fitOn(street, points) ?? []);
  const better = (one: StreetFit, other: StreetFit) =>
    one.measures.length - other.measures.length || other.offsetM - one.offsetM;
  return fits.reduce<StreetFit | null>((best, fit) => (!best || better(fit, best) > 0 ? fit : best), null);
}

function placeUnit(streets: WorkMapStreet[], unit: UnitDischarge): PlacedDischarge {
  const points = unit.points.filter(trusted);
  const last = points.at(-1);
  if (!last) return { state: 'noPlace', unit };
  const fit = bestFit(streets, points);
  if (!fit) return { state: 'outside', unit, point: { lat: last.lat, lng: last.lng } };
  const [fromM, toM] = [Math.min(...fit.measures), Math.max(...fit.measures)].map(Math.round) as [number, number];
  return { state: 'placed', unit, streetId: fit.street.id, fromM, toM };
}

function stretchOf(street: WorkMapStreet, units: Placed[]): SuggestedStretch | null {
  const onStreet = units.filter((one) => one.streetId === street.id);
  if (onStreet.length === 0) return null;
  const fromM = Math.min(...onStreet.map((one) => one.fromM));
  const toM = Math.max(...onStreet.map((one) => one.toM));
  const volume = onStreet.reduce((total, one) => total + (one.unit.m3 ?? 0), 0);
  return {
    streetId: street.id,
    streetName: street.name,
    fromM,
    toM,
    lengthM: toM - fromM,
    volumeM3: Math.round(volume * VOLUME_ROUNDING) / VOLUME_ROUNDING,
    units: onStreet.length,
  };
}

const arrivalOf = (unit: UnitDischarge) => unit.arrivalAt ?? NO_ARRIVAL;

export function suggestDischarges(map: WorkMap, discharges: UnitDischarge[]): DischargeSuggestion {
  const arrived = [...discharges].sort((one, other) => arrivalOf(one).localeCompare(arrivalOf(other)));
  const units = arrived.map((unit) => placeUnit(map.streets, unit));
  const placed = units.filter((one): one is Placed => one.state === 'placed');
  return { units, stretches: map.streets.flatMap((street) => stretchOf(street, placed) ?? []) };
}

export const dischargeHeadline = ({ units }: Pick<DischargeSuggestion, 'units'>) =>
  `${units.filter((one) => one.state === 'placed').length} de ${units.length} listas`;

/** A single photo measures no stretch: there is nothing to confirm until the person adjusts it. */
export const confirmDischargeLabel = ({ lengthM }: Pick<SuggestedStretch, 'lengthM'>): string | null =>
  lengthM > 0 ? `Confirmar avance (${metersLabel(lengthM)})` : null;

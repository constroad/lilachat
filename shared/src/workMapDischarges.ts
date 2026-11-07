import { suggestDischarges as suggestSharedDischarges, type Discharge, type DischargeSuggestion as SharedSuggestion, type StreetAxis, type SuggestedStretch } from '@constroad/shared/obra';
import { metersLabel, type WorkMap, type WorkMapPoint, type WorkMapStreet } from './workMap.js';

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
export type { SuggestedStretch };
export type DischargeSuggestion = { units: PlacedDischarge[]; stretches: SuggestedStretch[] };

type PlacedUnit = SharedSuggestion['units'][number];

/** The rules live in `@constroad/shared/obra` (one engine with Portal, 07/11); this only changes the shapes. */
const axisOf = (street: WorkMapStreet): StreetAxis => ({ _id: street.id, name: street.name, geometry: street.line, lengthM: street.lengthM });
const sharedDischargeOf = (unit: UnitDischarge): Discharge => ({
  dispatch_id: unit.dispatchId,
  plate: unit.plate,
  ...(unit.m3 === null ? {} : { m3: unit.m3 }),
  ...(unit.arrivalAt === null ? {} : { arrival_at: unit.arrivalAt }),
  points: unit.points.map(({ kind, lat, lng, precisionM, at }) => ({ kind, lat, lng, at, ...(precisionM === undefined ? {} : { precision_m: precisionM }) })),
});

function withUnit(placed: PlacedUnit, unit: UnitDischarge): PlacedDischarge {
  if (placed.state === 'placed') return { state: 'placed', unit, streetId: placed.streetId, fromM: placed.fromM, toM: placed.toM };
  return placed.state === 'outside' ? { state: 'outside', unit, point: placed.point } : { state: 'noPlace', unit };
}

export function suggestDischarges(map: WorkMap, discharges: UnitDischarge[]): DischargeSuggestion {
  const suggestion = suggestSharedDischarges(map.streets.map(axisOf), discharges.map(sharedDischargeOf));
  const byDispatch = new Map(discharges.map((unit) => [unit.dispatchId, unit]));
  const units = suggestion.units.flatMap((placed) => {
    const unit = byDispatch.get(placed.dispatchId);
    return unit ? [withUnit(placed, unit)] : [];
  });
  return { units, stretches: suggestion.stretches };
}

export const dischargeHeadline = ({ units }: Pick<DischargeSuggestion, 'units'>) =>
  `${units.filter((one) => one.state === 'placed').length} de ${units.length} listas`;

/** A single photo measures no stretch: there is nothing to confirm until the person adjusts it. */
export const confirmDischargeLabel = ({ lengthM }: Pick<SuggestedStretch, 'lengthM'>): string | null =>
  lengthM > 0 ? `Confirmar avance (${metersLabel(lengthM)})` : null;

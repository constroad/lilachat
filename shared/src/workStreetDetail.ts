import { approvedMetersIn, metersLabel, stationLabel, type WorkMap, type WorkMapScope, type WorkMapWork } from './workMap.js';

/**
 * A street and its stretches (design o-03, step 3 of the map, José 07/11): what each work has done
 * on the street, and every stretch with its stations, size, stage and works, to edit or delete it.
 * PURE: the APK and the web draw from here.
 */
export type StreetLayer = { workId: string; name: string; color: string; doneM: number; totalM: number; percent: number };
export type StreetScopeRow = { id: string; title: string; range: string; summary: string; stageName: string | null; works: StreetLayer[]; scope: WorkMapScope };
export type StreetDetail = { id: string; name: string; lengthM: number; widthM: number | null; headline: string; layers: StreetLayer[]; scopes: StreetScopeRow[] };

const FULL_PCT = 100;

/** «6,0 m»: the width reads with one decimal, as the drawings write it. */
export const widthLabel = (widthM: number) => `${widthM.toFixed(1).replace('.', ',')} m`;

const percentOf = (doneM: number, totalM: number) => (totalM > 0 ? Math.min(FULL_PCT, Math.round((doneM / totalM) * FULL_PCT)) : 0);

function layerOf(map: WorkMap, work: WorkMapWork, scopes: WorkMapScope[]): StreetLayer {
  const mine = scopes.filter((scope) => scope.workIds.includes(work.id));
  const totalM = mine.reduce((sum, scope) => sum + Math.max(0, scope.toM - scope.fromM), 0);
  const doneM = mine.reduce((sum, scope) => sum + approvedMetersIn(map.progress, scope, work.id), 0);
  return { workId: work.id, name: work.name, color: work.color, doneM, totalM, percent: percentOf(doneM, totalM) };
}

function scopeRow(map: WorkMap, scope: WorkMapScope, index: number, streetWidthM: number | null): StreetScopeRow {
  const lengthM = Math.max(0, scope.toM - scope.fromM);
  const widthM = scope.widthM ?? streetWidthM;
  const size = widthM ? [metersLabel(lengthM), widthLabel(widthM), `${metersLabel(lengthM * widthM).slice(0, -2)} m²`] : [metersLabel(lengthM)];
  const works = map.works.filter((work) => scope.workIds.includes(work.id)).map((work) => layerOf(map, work, [scope]));
  return {
    id: scope.id,
    title: `Tramo ${index + 1}`,
    range: `${stationLabel(scope.fromM)} a ${stationLabel(scope.toM)}`,
    summary: size.join(' · '),
    stageName: map.stages.find((stage) => stage.id === scope.stageId)?.name ?? null,
    works,
    scope,
  };
}

/** null when the street is not on the map (deleted meanwhile). */
export function streetDetailOf(map: WorkMap, streetId: string): StreetDetail | null {
  const street = map.streets.find((one) => one.id === streetId);
  if (!street) return null;
  const widthM = street.widthM ?? null;
  const scopes = map.scopes.filter((scope) => scope.streetId === streetId).sort((left, right) => left.fromM - right.fromM);
  const layers = map.works.filter((work) => scopes.some((scope) => scope.workIds.includes(work.id))).map((work) => layerOf(map, work, scopes));
  return {
    id: street.id,
    name: street.name,
    lengthM: street.lengthM,
    widthM,
    headline: [metersLabel(street.lengthM), ...(widthM ? [widthLabel(widthM)] : [])].join(' · '),
    layers,
    scopes: scopes.map((scope, index) => scopeRow(map, scope, index, widthM)),
  };
}

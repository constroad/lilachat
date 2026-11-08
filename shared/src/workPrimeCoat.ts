import { approvedMetersIn, metersLabel, stationLabel, type WorkMap } from './workMap.js';
import { placeOnStreets, type MapPhoto, type Placed } from './workMapPhotos.js';
import { stretchWorksOf } from './workMapProgress.js';
import type { ManualProgressDraft } from './workManualProgress.js';

/**
 * #253: the prime coat report (CTL-IMP) suggests progress too (José 08/11: he could not see how the
 * suggested progress comes from the prime coat). Each photo of the spraying keeps where it was
 * taken; one report on one street goes from its first photo to its last. It is a suggestion: the
 * manual progress form opens already filled and the person sends it (Portal's proposal, 08/11: the
 * manual progress tool, without a new one). PURE: the APK and the web draw from here.
 */
export const PRIME_COAT_REPORT = 'CTL-IMP';
export const PRIME_COAT_TITLE = 'Avance que marcan las fotos del riego';
export const PRIME_COAT_HOW = 'Cada foto del Control de imprimación guarda dónde se tomó. El tramo va de la primera a la última foto sobre la calle.';
export type PrimeCoatStretch = { id: string; reportId: string | null; streetId: string; streetName: string; fromM: number; toM: number; lengthM: number; photos: number };
export type PrimeCoatSuggestion = { stretches: PrimeCoatStretch[]; outside: number };

/** A metre short of the stretch still counts as covered: the photos are taken by hand. */
const COVERED_SLACK_M = 1;
const PRIME_COAT_NAME = /imprim/i;

const primeWorkOf = (map: Pick<WorkMap, 'scopes' | 'works'>, streetId: string) => stretchWorksOf(map, streetId).find((work) => PRIME_COAT_NAME.test(work.name));

function stretchOf(map: WorkMap, key: string, group: Placed[]): PrimeCoatStretch {
  const streetId = group[0]!.streetId!;
  const stations = group.map((one) => Math.round(one.atM));
  const [fromM, toM] = [Math.min(...stations), Math.max(...stations)];
  const streetName = map.streets.find((street) => street.id === streetId)?.name ?? '';
  return { id: key, reportId: group[0]!.photo.reportId ?? null, streetId, streetName, fromM, toM, lengthM: toM - fromM, photos: group.length };
}

function alreadyApproved(map: WorkMap, stretch: PrimeCoatStretch): boolean {
  const work = primeWorkOf(map, stretch.streetId);
  if (!work || stretch.lengthM <= 0) return false;
  const scope = { id: stretch.id, streetId: stretch.streetId, fromM: stretch.fromM, toM: stretch.toM, workIds: [work.id] };
  return approvedMetersIn(map.progress, scope, work.id) >= stretch.lengthM - COVERED_SLACK_M;
}

/** Report by report and street by street, in the map's order. */
export function suggestPrimeCoat(map: WorkMap, photos: MapPhoto[]): PrimeCoatSuggestion {
  const placed = photos.filter((photo) => photo.reportType === PRIME_COAT_REPORT).map((photo) => placeOnStreets(map, photo));
  const groups = new Map<string, Placed[]>();
  for (const one of placed.filter((each) => each.streetId !== null)) {
    const key = `${one.photo.reportId ?? 'sin-informe'}|${one.streetId}`;
    groups.set(key, [...(groups.get(key) ?? []), one]);
  }
  const order = (streetId: string) => map.streets.findIndex((street) => street.id === streetId);
  const stretches = [...groups.entries()].map(([key, group]) => stretchOf(map, key, group)).filter((stretch) => !alreadyApproved(map, stretch));
  stretches.sort((left, right) => order(left.streetId) - order(right.streetId) || left.fromM - right.fromM);
  return { stretches, outside: placed.filter((one) => one.streetId === null).length };
}

/** What the stretch is, in one sentence, and that nothing counts until it is sent. */
export function primeCoatExplain(stretch: Pick<PrimeCoatStretch, 'photos' | 'fromM' | 'toM' | 'streetName'>): string {
  const where = stretch.toM > stretch.fromM ? `entre ${stationLabel(stretch.fromM)} y ${stationLabel(stretch.toM)}` : `en ${stationLabel(stretch.fromM)}`;
  const who = stretch.photos === 1 ? 'La foto del riego cae' : `Las ${stretch.photos} fotos del riego caen`;
  return `${who} ${where} de ${stretch.streetName}. Revisa el tramo y regístralo: recién ahí se suma al avance.`;
}

/** The photos that add nothing, and why; null when all fell on a street. */
export const primeCoatGaps = ({ outside }: Pick<PrimeCoatSuggestion, 'outside'>): string | null =>
  outside ? `${outside} ${outside === 1 ? 'foto' : 'fotos'} fuera de las calles de la obra` : null;

/** «+80 m» for the card. */
export const primeCoatLength = ({ lengthM }: Pick<PrimeCoatStretch, 'lengthM'>): string => `+${metersLabel(lengthM)}`;

/** «Registrar avance» filled with the prime coat work (when the street has one) and the photos' range. */
export const primeCoatDraftOf = (map: WorkMap, stretch: PrimeCoatStretch): ManualProgressDraft =>
  ({ workId: primeWorkOf(map, stretch.streetId)?.id ?? null, fromM: stretch.fromM, toM: stretch.toM, photoIds: [], note: '' });

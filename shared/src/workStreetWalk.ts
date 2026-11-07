import { lineLengthM, metersLabel, type WorkMapPoint } from './workMap.js';
import { STREET_POINTS_MAX, type StreetDraft } from './workStreetDraft.js';

/**
 * «Caminar con GPS» (design o-13, step 3 of the map, José 07/11): the engineer taps «Empezar»,
 * walks the street's axis and taps «Terminar». A fix too vague, or too close to the last one, is
 * shown but not drawn, so standing still or a weak signal does not scribble the line.
 * PURE: the APK and the web feed it the phone's fixes.
 */
export type GpsFix = WorkMapPoint & { accuracyM: number };
export type WalkState = { walking: boolean; done: boolean; points: WorkMapPoint[]; accuracyM: number | null };

/** A phone in the open gives 3 to 10 m; past 25 m the point could be on the next block. */
export const WALK_MAX_ACCURACY_M = 25;
/** Below this the fix is the person standing still, not the street bending. */
export const WALK_MIN_STEP_M = 5;
export const WALK_IDLE: WalkState = { walking: false, done: false, points: [], accuracyM: null };

export const startWalk = (walk: WalkState): WalkState => ({ ...walk, walking: true, done: false, points: [] });
export const stopWalk = (walk: WalkState): WalkState => ({ ...walk, walking: false, done: true });

const roundedM = (meters: number) => Math.round(meters);

export function walkFix(walk: WalkState, fix: GpsFix): WalkState {
  const seen = { ...walk, accuracyM: roundedM(fix.accuracyM) };
  if (!walk.walking || fix.accuracyM > WALK_MAX_ACCURACY_M || walk.points.length >= STREET_POINTS_MAX) return seen;
  const point = { lat: fix.lat, lng: fix.lng };
  const last = walk.points[walk.points.length - 1];
  if (last && lineLengthM([last, point]) < WALK_MIN_STEP_M) return seen;
  return { ...seen, points: [...walk.points, point] };
}

export function walkHint(walk: WalkState): string {
  const walkedM = walk.points.length > 1 ? lineLengthM(walk.points) : 0;
  if (walk.done) return `Listo: ${metersLabel(walkedM)} caminados. Si no es así, toca Deshacer.`;
  if (!walk.walking) return 'Toca «Empezar» y camina por el eje de la calle.';
  if (walk.accuracyM === null) return 'Buscando señal de GPS…';
  if (walk.accuracyM > WALK_MAX_ACCURACY_M) return `GPS débil (±${walk.accuracyM} m): espera a cielo abierto.`;
  return `Caminando · ${metersLabel(walkedM)} · GPS ±${walk.accuracyM} m`;
}

/** The walked line becomes the street being drawn. */
export const walkedDraft = (draft: StreetDraft, walk: WalkState): StreetDraft => ({ ...draft, points: walk.points });

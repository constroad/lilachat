import { lineLengthM, metersLabel, type WorkMapPoint } from './workMap.js';
import { STREET_POINTS_MAX, type StreetDraft } from './workStreetDraft.js';
import type { DischargePin } from './workMapProgress.js';

/**
 * «Caminar con GPS» (design o-13, step 3 of the map, José 07/11): the engineer taps «Empezar»,
 * walks the street's axis and taps «Terminar». A fix too vague, or too close to the last one, is
 * shown but not drawn, so standing still or a weak signal does not scribble the line.
 * PURE: the APK and the web feed it the phone's fixes.
 */
export type GpsFix = WorkMapPoint & { accuracyM: number };
/** `position`: the last fix, drawn as «mi posición»; `discarded`: fixes too vague to draw (o-13). */
export type WalkState = { walking: boolean; done: boolean; paused: boolean; points: WorkMapPoint[]; accuracyM: number | null; position: GpsFix | null; discarded: number };

/** A phone in the open gives 3 to 10 m; past 25 m the point could be on the next block. */
export const WALK_MAX_ACCURACY_M = 25;
/** Below this the fix is the person standing still, not the street bending. */
export const WALK_MIN_STEP_M = 5;
export const WALK_IDLE: WalkState = { walking: false, done: false, paused: false, points: [], accuracyM: null, position: null, discarded: 0 };
/** «Deshacer último tramo» takes back about this much, not the whole walk. */
export const WALK_UNDO_M = 20;

export const startWalk = (walk: WalkState): WalkState => ({ ...walk, walking: true, done: false, paused: false, points: [], discarded: 0 });
export const pauseWalk = (walk: WalkState): WalkState => ({ ...walk, paused: true });
export const resumeWalk = (walk: WalkState): WalkState => ({ ...walk, paused: false });
export const stopWalk = (walk: WalkState): WalkState => ({ ...walk, walking: false, paused: false, done: true });

const roundedM = (meters: number) => Math.round(meters);

export function walkFix(walk: WalkState, fix: GpsFix): WalkState {
  const seen = { ...walk, accuracyM: roundedM(fix.accuracyM), position: fix };
  if (!walk.walking || walk.paused || walk.points.length >= STREET_POINTS_MAX) return seen;
  if (fix.accuracyM > WALK_MAX_ACCURACY_M) return { ...seen, discarded: walk.discarded + 1 };
  const point = { lat: fix.lat, lng: fix.lng };
  const last = walk.points[walk.points.length - 1];
  if (last && lineLengthM([last, point]) < WALK_MIN_STEP_M) return seen;
  return { ...seen, points: [...walk.points, point] };
}

export function walkHint(walk: WalkState): string {
  const walkedM = walk.points.length > 1 ? lineLengthM(walk.points) : 0;
  if (walk.done) return `Listo: ${metersLabel(walkedM)} caminados. Si no es así, toca Deshacer.`;
  if (!walk.walking) return 'Toca «Empezar» y camina por el eje de la calle.';
  if (walk.paused) return `En pausa · ${metersLabel(walkedM)} caminados. Toca «Seguir» para continuar.`;
  if (walk.accuracyM === null) return 'Buscando señal de GPS…';
  if (walk.accuracyM > WALK_MAX_ACCURACY_M) return `GPS débil (±${walk.accuracyM} m): espera a cielo abierto.`;
  const discarded = walk.discarded ? ` · ${walk.discarded} ${walk.discarded === 1 ? 'lectura descartada' : 'lecturas descartadas'}` : '';
  return `Caminando · ${metersLabel(walkedM)} · GPS ±${walk.accuracyM} m${discarded}`;
}

/** The walked line becomes the street being drawn. */
export const walkedDraft = (draft: StreetDraft, walk: WalkState): StreetDraft => ({ ...draft, points: walk.points });

/** «Deshacer último tramo»: the points of about the last twenty metres go; the rest of the walk stays. */
export function undoWalkStep(walk: WalkState): WalkState {
  const points = [...walk.points];
  let removedM = 0;
  while (points.length > 1 && removedM < WALK_UNDO_M) {
    const last = points.pop();
    const before = points[points.length - 1];
    if (last && before) removedM += lineLengthM([before, last]);
  }
  return { ...walk, points: removedM >= WALK_UNDO_M || walk.points.length > 1 ? points : [] };
}

/** «Mi posición» over the map while walking (o-13): the last fix, even a vague one or while paused. */
export const walkPositionPins = (walk: WalkState): DischargePin[] =>
  (walk.walking && walk.position ? [{ id: 'mi-posicion', label: '', lat: walk.position.lat, lng: walk.position.lng, outside: false }] : []);

import { lengthOfLine, pickedLine, pickedRange, pickStreet, pointAtMeasure, projectToLine, stationLabel, streetAtTap, tapOnPick, type StreetPick, type TapFeatures } from '@constroad/shared/obra';
/** What the maps need to ask for the roads at a tap; the rules stay in the package. */
export { NAMED_ROAD_LAYER, ROAD_SOURCE_LAYERS, tapBox, tapTolerancePx, type BasemapFeatureLike, type TapFeatures } from '@constroad/shared/obra';
import { addStreetPoint, EMPTY_STREET, streetDraftLengthM, undoStreetPoint, type DrawMode, type StreetDraft } from './workStreetDraft.js';
import { metersLabel, type WorkMapPoint } from './workMap.js';

/**
 * The street-tap way of the street editor (audit 07/11, José asked it easy and fluid for a field
 * engineer). The engineer taps a street of the map: it comes whole, with its name. Then two taps on
 * it mark where the work starts and ends, and the line follows the street's real axis. «A mano»
 * stays for a pasaje the map does not have. The rules live in `@constroad/shared/obra`.
 * PURE: the APK and the web draw from here.
 */
export const DRAW_MODES: ReadonlyArray<{ mode: DrawMode; label: string }> = [
  { mode: 'street', label: 'Tocar la calle' },
  { mode: 'gps', label: 'Caminar GPS' },
  { mode: 'hand', label: 'A mano' },
];

export const NO_STREET_THERE = 'Ahí no hay una calle del mapa. Toca sobre la vía, o dibújala «A mano».';

/** Another way of drawing starts the line again; the name and the width stay. */
export const setDrawMode = (draft: StreetDraft, mode: DrawMode): StreetDraft => (draft.mode === mode ? draft : { ...EMPTY_STREET, name: draft.name, widthM: draft.widthM, ...(draft.stageId ? { stageId: draft.stageId } : {}), mode });

/** The «A mano» counter: «1 punto», «3 puntos». */
export const handPointsLabel = (count: number): string => (count === 1 ? '1 punto' : `${count} puntos`);

/** What a switch of the way to draw would erase, as a question; `null` when nothing is lost (audit 08/11: 734 m gone in silence). */
export function modeChangeLoss(draft: StreetDraft, mode: DrawMode): string | null {
  if (draft.mode === mode || draft.points.length === 0) return null;
  const what = draft.points.length === 1 ? handPointsLabel(1) : `${streetDraftLengthM(draft)} m`;
  return `Cambiar de forma borra lo que marcaste (${what}). ¿Cambiar igual?`;
}

const withPick = (draft: StreetDraft, pick: StreetPick, reversed = false): StreetDraft => {
  const line = pickedLine(pick);
  return { ...draft, pick, reversed, points: reversed ? [...line].reverse() : line };
};

/** The end tap landed before the start on the map's road: the package sorts them, the line turns around. */
const endedBehind = (before: StreetPick, after: StreetPick): boolean => before.fromM !== null && before.toM === null && after.toM === before.fromM && after.fromM !== before.fromM;

/** The map's name fills the field unless the person wrote their own. */
const nameFor = (draft: StreetDraft, mapName: string): string => (!draft.name.trim() || draft.name === draft.pick?.name ? mapName : draft.name);

function pickAt(draft: StreetDraft, at: TapFeatures): { draft: StreetDraft; problem: string | null } {
  const street = streetAtTap(at);
  const pick = street ? pickStreet(street) : null;
  if (!pick) return { draft, problem: NO_STREET_THERE };
  return { draft: withPick({ ...draft, name: nameFor(draft, pick.name) }, pick), problem: null };
}

/** One tap on the map: a bend by hand; a street, its start or its end; or another street. */
export function tapStreetDraft(draft: StreetDraft, at: TapFeatures): { draft: StreetDraft; problem: string | null } {
  if (draft.mode === 'hand') return { draft: addStreetPoint(draft, at.tap), problem: null };
  if (draft.mode === 'gps') return { draft, problem: null };
  if (!draft.pick) return pickAt(draft, at);
  const tapped = tapOnPick(draft.pick, at.tap);
  return tapped.kind === 'marked' ? { draft: withPick(draft, tapped.pick, endedBehind(draft.pick, tapped.pick)), problem: null } : pickAt(draft, at);
}

/** «Deshacer»: the end, then the start, then the street; by hand, the last bend. */
export function undoStreetDraft(draft: StreetDraft): StreetDraft {
  if (draft.mode === 'gps') return { ...draft, points: [] };
  if (draft.mode === 'hand' || !draft.pick) return undoStreetPoint(draft);
  const { pick } = draft;
  if (pick.toM !== null) return withPick(draft, { ...pick, fromM: draft.reversed ? pick.toM : pick.fromM, toM: null });
  if (pick.fromM !== null) return withPick(draft, { ...pick, fromM: null });
  return { ...draft, pick: null, points: [], name: draft.name === pick.name ? '' : draft.name };
}

/** What the next tap does, in the band over the map. */
export function streetDraftHint(draft: StreetDraft): string {
  if (draft.mode === 'hand') return 'Toca el inicio, las curvas y el fin sobre la vía.';
  if (!draft.pick) return 'Toca la calle donde vas a trabajar.';
  const { step } = pickedRange(draft.pick);
  if (step === 'start') return 'Arrastra los extremos para recortar, o toca dónde empieza la obra.';
  if (step === 'end') return 'Toca dónde termina la obra.';
  return 'Arrastra los extremos para ajustar, o guarda la calle.';
}

/**
 * «Inicio 0+000 · Fin 0+240»: the street that is saved is the marked stretch, so its chainage starts
 * at zero. Counting from where the map's road begins (0+700) said nothing to the engineer (audit 07/11).
 */
export function streetDraftEnds(draft: StreetDraft): string | null {
  if (draft.mode !== 'street' || !draft.pick) return null;
  return `Inicio ${stationLabel(0)} · Fin ${stationLabel(streetDraftLengthM(draft))}`;
}

/** Design o-02's «Área neta»: length times width, once both are there. */
export function streetDraftArea(draft: StreetDraft): string | null {
  const lengthM = streetDraftLengthM(draft);
  if (!lengthM || draft.widthM === null || !(draft.widthM > 0)) return null;
  return `${metersLabel(lengthM * draft.widthM).slice(0, -2)} m²`;
}

/**
 * The ends of a picked street can be dragged (José 08/11: «selecciono toda la calle y no quiero los
 * últimos 100 m»). The gesture Portal's editor already has (`dragScopeHandle`): the dropped point is
 * projected on the street's axis, so the stretch never leaves the road. `start` and `end` are the
 * person's 0+000 and end, which on a street marked backwards are the map's end and start.
 */
export type StreetEnd = 'start' | 'end';
export type StreetHandle = { handle: StreetEnd; point: WorkMapPoint; label: string };

/** Farther than this from the axis, the drop was a slip of the finger (Portal: `MAX_OFF_AXIS_M`). */
export const HANDLE_REACH_M = 40;
/** The shortest stretch a drag leaves (Portal: `MIN_SCOPE_M`). */
export const HANDLE_MIN_M = 5;
export const HANDLE_OFF_STREET = 'Suelta el extremo sobre la calle.';

/** Which end of the map's road a handle of the person is. */
const axisSide = (draft: StreetDraft, handle: StreetEnd): 'from' | 'to' => ((handle === 'start') !== Boolean(draft.reversed) ? 'from' : 'to');

export function streetDraftHandles(draft: StreetDraft): StreetHandle[] {
  if (draft.mode !== 'street' || !draft.pick) return [];
  const { fromM, toM } = pickedRange(draft.pick);
  const lengthM = Math.round(toM - fromM);
  const handles: StreetHandle[] = [];
  for (const handle of ['start', 'end'] as const) {
    const point = pointAtMeasure(draft.pick.axis, axisSide(draft, handle) === 'from' ? fromM : toM);
    if (point) handles.push({ handle, point: { lat: point.lat, lng: point.lng }, label: stationLabel(handle === 'start' ? 0 : lengthM) });
  }
  return handles;
}

/** One end to `measureM` along the map's road, kept inside the road and never past the other end. */
function moveEnd(draft: StreetDraft, pick: StreetPick, handle: StreetEnd, measureM: number): StreetDraft {
  const totalM = Math.round(lengthOfLine(pick.axis));
  const { fromM, toM } = pickedRange(pick);
  const atM = Math.round(Math.max(0, Math.min(totalM, measureM)));
  const range = axisSide(draft, handle) === 'from'
    ? { fromM: Math.max(0, Math.min(atM, toM - HANDLE_MIN_M)), toM }
    : { fromM, toM: Math.min(totalM, Math.max(atM, fromM + HANDLE_MIN_M)) };
  return withPick(draft, { ...pick, ...range }, draft.reversed);
}

/** A handle dropped on the map. Off the street, nothing moves and the band says why. */
export function dragStreetEnd(draft: StreetDraft, handle: StreetEnd, point: WorkMapPoint): { draft: StreetDraft; problem: string | null } {
  if (draft.mode !== 'street' || !draft.pick) return { draft, problem: null };
  const projected = projectToLine(draft.pick.axis, point);
  if (!projected || projected.distanceM > HANDLE_REACH_M) return { draft, problem: HANDLE_OFF_STREET };
  return { draft: moveEnd(draft, draft.pick, handle, projected.measureM), problem: null };
}

/** «−10 m» / «+10 m»: an end moved along the person's chainage, for when the finger is too coarse. */
export function nudgeStreetEnd(draft: StreetDraft, handle: StreetEnd, deltaM: number): StreetDraft {
  if (draft.mode !== 'street' || !draft.pick) return draft;
  const { fromM, toM } = pickedRange(draft.pick);
  const side = axisSide(draft, handle);
  const towardEnd = handle === 'end' ? deltaM : -deltaM;
  const shift = side === 'to' ? towardEnd : -towardEnd;
  return moveEnd(draft, draft.pick, handle, (side === 'from' ? fromM : toM) + shift);
}

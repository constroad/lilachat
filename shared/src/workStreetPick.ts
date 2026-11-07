import { pickedLine, pickedRange, pickStreet, stationLabel, streetAtTap, tapOnPick, type StreetPick, type TapFeatures } from '@constroad/shared/obra';
/** What the maps need to ask for the roads at a tap; the rules stay in the package. */
export { NAMED_ROAD_LAYER, ROAD_SOURCE_LAYERS, tapBox, tapTolerancePx, type BasemapFeatureLike, type TapFeatures } from '@constroad/shared/obra';
import { addStreetPoint, EMPTY_STREET, undoStreetPoint, type DrawMode, type StreetDraft } from './workStreetDraft.js';

/**
 * «Tocar la calle» of the street editor (audit 07/11, José: «fácil y fluido para un ingeniero de
 * campo»). The engineer taps a street of the map: it comes whole, with its name. Then two taps on
 * it mark where the work starts and ends, and the line follows the street's real axis. «A mano»
 * stays for a pasaje the map does not have. The rules live in `@constroad/shared/obra`.
 * PURE: the APK and the web draw from here.
 */
export const DRAW_MODES: ReadonlyArray<{ mode: DrawMode; label: string }> = [
  { mode: 'street', label: 'Tocar la calle' },
  { mode: 'hand', label: 'A mano' },
];

export const NO_STREET_THERE = 'Ahí no hay una calle del mapa. Toca sobre la vía, o dibújala «A mano».';

/** Another way of drawing starts the line again; the name and the width stay. */
export const setDrawMode = (draft: StreetDraft, mode: DrawMode): StreetDraft => (draft.mode === mode ? draft : { ...EMPTY_STREET, name: draft.name, widthM: draft.widthM, mode });

const withPick = (draft: StreetDraft, pick: StreetPick): StreetDraft => ({ ...draft, pick, points: pickedLine(pick) });

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
  if (!draft.pick) return pickAt(draft, at);
  const tapped = tapOnPick(draft.pick, at.tap);
  return tapped.kind === 'marked' ? { draft: withPick(draft, tapped.pick), problem: null } : pickAt(draft, at);
}

/** «Deshacer»: the end, then the start, then the street; by hand, the last bend. */
export function undoStreetDraft(draft: StreetDraft): StreetDraft {
  if (draft.mode === 'hand' || !draft.pick) return undoStreetPoint(draft);
  const { pick } = draft;
  if (pick.toM !== null) return withPick(draft, { ...pick, fromM: pick.fromM, toM: null });
  if (pick.fromM !== null) return withPick(draft, { ...pick, fromM: null });
  return { ...draft, pick: null, points: [], name: draft.name === pick.name ? '' : draft.name };
}

/** What the next tap does, in the band over the map. */
export function streetDraftHint(draft: StreetDraft): string {
  if (draft.mode === 'hand') return 'Toca el inicio, las curvas y el fin sobre la vía.';
  if (!draft.pick) return 'Toca la calle donde vas a trabajar.';
  const { step } = pickedRange(draft.pick);
  if (step === 'start') return 'Toca dónde empieza la obra, o guarda la calle entera.';
  if (step === 'end') return 'Toca dónde termina la obra.';
  return 'Listo. Si no es ahí, toca Deshacer.';
}

/** «Inicio 0+080 · Fin 0+320» on the street's own chainage, once a stretch is marked. */
export function streetDraftEnds(draft: StreetDraft): string | null {
  if (draft.mode !== 'street' || !draft.pick) return null;
  const { fromM, toM } = pickedRange(draft.pick);
  return `Inicio ${stationLabel(fromM)} · Fin ${stationLabel(toM)}`;
}

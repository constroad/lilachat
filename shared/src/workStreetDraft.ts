import { lineLengthM, type WorkMapLine, type WorkMapPoint } from './workMap.js';
import type { DischargePin } from './workMapProgress.js';
import { FORMS_LEVEL } from './appForms.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';

/**
 * Drawing a street of the work (design o-02, José 07/11: everyone draws and updates). The person
 * taps the start, the bends and the end on the map; Portal measures it again when it saves.
 * PURE: the APK and the web draw from here and send `workStreetRequest`.
 */
export type StreetDraft = { name: string; points: WorkMapPoint[]; widthM: number | null };

export const STREET_POINTS_MAX = 500;
export const STREET_NAME_MAX = 80;
export const STREET_WIDTH_MAX_M = 60;
export const EMPTY_STREET: StreetDraft = { name: '', points: [], widthM: null };

export const DRAFT_NEEDS_POINTS = 'Toca el inicio y el fin de la calle en el mapa.';
export const DRAFT_NEEDS_NAME = 'Ponle nombre a la calle.';
export const DRAFT_NAME_TOO_LONG = `El nombre lleva hasta ${STREET_NAME_MAX} letras.`;
export const DRAFT_BAD_WIDTH = `El ancho va de 0,1 a ${STREET_WIDTH_MAX_M} m.`;

/** A tap adds a bend; past the limit the line stays as it is. */
export const addStreetPoint = (draft: StreetDraft, point: WorkMapPoint): StreetDraft =>
  draft.points.length >= STREET_POINTS_MAX ? draft : { ...draft, points: [...draft.points, { lat: point.lat, lng: point.lng }] };

/** «Deshacer» takes back the last tap. */
export const undoStreetPoint = (draft: StreetDraft): StreetDraft => ({ ...draft, points: draft.points.slice(0, -1) });

/** Whole meters, following the bends: what the person reads while drawing. */
export const streetDraftLengthM = (draft: Pick<StreetDraft, 'points'>): number => (draft.points.length < 2 ? 0 : Math.round(lineLengthM(draft.points)));

/** What stops «Guardar calle», in the order the person meets it on the screen. */
export function streetDraftProblem(draft: StreetDraft): string | null {
  if (draft.points.length < 2) return DRAFT_NEEDS_POINTS;
  const name = draft.name.trim();
  if (!name) return DRAFT_NEEDS_NAME;
  if (name.length > STREET_NAME_MAX) return DRAFT_NAME_TOO_LONG;
  if (draft.widthM !== null && !(draft.widthM > 0 && draft.widthM <= STREET_WIDTH_MAX_M)) return DRAFT_BAD_WIDTH;
  return null;
}

/** The line being drawn: MapLibre paints a hex, not a CSS variable. */
export const WORK_MAP_DRAFT_COLOR = '#7c3aed';

/** Each tap as a numbered pin, the first one the start (design o-02). */
export const streetDraftPins = (draft: Pick<StreetDraft, 'points'>): DischargePin[] =>
  draft.points.map((point, index) => ({ id: `trazo-${index + 1}`, label: String(index + 1), lat: point.lat, lng: point.lng, outside: false }));

/** The line once there are a start and an end. */
export const streetDraftLines = (draft: Pick<StreetDraft, 'points'>): WorkMapLine[] =>
  draft.points.length < 2 ? [] : [{ streetId: 'trazo', color: WORK_MAP_DRAFT_COLOR, coordinates: draft.points.map((point) => [point.lng, point.lat] as [number, number]) }];

export type WorkStreetRequest = { kind: 'work_street'; name: string; line: WorkMapPoint[]; width_m?: number; entry_id: string; forms: number };

export const STREET_SAVED = 'Calle guardada. Ya aparece en el mapa.';
export const STREET_FAILED = 'No se pudo guardar la calle. Revisa tu señal y vuelve a guardar.';

/** The same `entry_id` on a resend: Portal answers what it answered the first time, so a lost answer never draws the street twice. */
export const workStreetRequest = (draft: StreetDraft, entryId: string): WorkStreetRequest => ({
  kind: 'work_street',
  name: draft.name.trim(),
  line: draft.points.map(({ lat, lng }) => ({ lat, lng })),
  ...(draft.widthM !== null ? { width_m: draft.widthM } : {}),
  entry_id: entryId,
  forms: FORMS_LEVEL,
});

/** The street lives in the context the server put together; the form only confirms it. */
export const sendWorkStreet = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: STREET_SAVED, failed: STREET_FAILED });

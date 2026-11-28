import { metersLabel, type WorkMap } from './workMap.js';
import { brushRequests } from './workMapBrush.js';
import type { WorkProgressResult } from './workProgressSend.js';
import { labelProblem, sendWorkScope, sendWorkTag, workTagRequest, type MapEditSend, type WorkScopeRequest } from './workScopeDraft.js';

/**
 * «Nueva capa» (design ma03, José 28/11): the layers a paving job always has, each with its own
 * color, picked with a tap; «Otra…» is the only place where the person types. With «Todas las
 * calles de la obra» on, the new layer goes onto every street the brush way (one work_scope per
 * street); off, the brush opens for that layer. PURE: the APK and the web draw and send from here.
 */
export type LayerCatalogEntry = { key: string; name: string; color: string };
export type LayerChoice = LayerCatalogEntry & { taken: boolean };
export type LayerMetrado = { streets: number; lengthM: number; areaM2: number; missingWidth: number; line: string };
/** What «Crear capa» sends: the name and color picked, and whether it goes onto every street. */
export type LayerPlan = { name: string; color: string; allStreets: boolean };
/** `paint`: the switch was off, so the brush opens for the new layer. */
export type LayerCreated = { failure: string | null; workId: string | null; paint: boolean };

/** Map colors (MapLibre paints hex): apart from each other and readable on the light and dark map. */
export const LAYER_CATALOG: readonly LayerCatalogEntry[] = [
  { key: 'imprimacion', name: 'Imprimación', color: '#d97706' },
  { key: 'riego-liga', name: 'Riego de liga', color: '#0f766e' },
  { key: 'carpeta-2', name: 'Carpeta asfáltica 2"', color: '#2563eb' },
  { key: 'carpeta-3', name: 'Carpeta asfáltica 3"', color: '#7c3aed' },
  { key: 'base-granular', name: 'Base granular', color: '#a16207' },
  { key: 'sello-asfaltico', name: 'Sello asfáltico', color: '#64748b' },
];
/** «Otra…» starts on a red no catalog layer uses. */
export const OTHER_LAYER_COLOR = '#dc2626';
export const OTHER_LAYER_KEY = 'otra';

export const LAYER_TAKEN = 'Ya está';
export const LAYER_EXISTS = 'Esa capa ya está en el servicio.';
export const LAYER_PICK_ONE = 'Elige una capa.';
export const LAYER_NOT_FOUND = 'La capa se creó, pero el mapa aún no la muestra. Búscala en «Trabajos».';

/** «Carpeta Asfáltica 2”» and «carpeta asfaltica 2"» are the same layer: no case, accents, spaces nor quote style. */
export function foldLayerName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').replace(/[“”″'’]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
}

const takenNames = (map: Pick<WorkMap, 'works'>) => new Set(map.works.map((work) => foldLayerName(work.name)));

export const layerTaken = (map: Pick<WorkMap, 'works'>, name: string): boolean => takenNames(map).has(foldLayerName(name));

/** The catalog chips, the ones the service already has marked «Ya está». */
export function layerChoicesOf(map: Pick<WorkMap, 'works'>): LayerChoice[] {
  const taken = takenNames(map);
  return LAYER_CATALOG.map((entry) => ({ ...entry, taken: taken.has(foldLayerName(entry.name)) }));
}

const streetsLabel = (count: number) => `${count} ${count === 1 ? 'calle' : 'calles'}`;
const areaLabel = (squareM: number) => `${metersLabel(squareM).replace(/ m$/, '')} m²`;

/** «N calles · L m · A m²»: length × width of every street; a street without width adds no m². */
export function layerMetradoOf(map: Pick<WorkMap, 'streets'>): LayerMetrado {
  const lengthM = map.streets.reduce((sum, street) => sum + street.lengthM, 0);
  const areaM2 = map.streets.reduce((sum, street) => sum + street.lengthM * (street.widthM ?? 0), 0);
  const missingWidth = map.streets.filter((street) => !street.widthM).length;
  const parts = [streetsLabel(map.streets.length), metersLabel(lengthM)];
  if (missingWidth < map.streets.length) parts.push(areaLabel(areaM2));
  if (missingWidth) parts.push(`sin ancho en ${missingWidth} ${missingWidth === 1 ? 'calle' : 'calles'}`);
  return { streets: map.streets.length, lengthM, areaM2: Math.round(areaM2), missingWidth, line: parts.join(' · ') };
}

export type LayerStreetRow = { id: string; name: string; detail: string; area: string | null };

/** One row per street under the switch: «284 m · ancho 6 m» and its m², or «sin ancho». */
export function layerStreetRowsOf(map: Pick<WorkMap, 'streets'>): LayerStreetRow[] {
  return map.streets.map((street) => {
    const width = street.widthM ? `ancho ${String(street.widthM).replace('.', ',')} m` : 'sin ancho';
    return { id: street.id, name: street.name, detail: `${metersLabel(street.lengthM)} · ${width}`, area: street.widthM ? areaLabel(street.lengthM * street.widthM) : null };
  });
}

/** What is wrong with the plan before sending: no name, too long, or already in the service. */
export function layerPlanProblem(map: Pick<WorkMap, 'works'>, plan: LayerPlan | null): string | null {
  if (!plan) return LAYER_PICK_ONE;
  return labelProblem(plan.name) ?? (layerTaken(map, plan.name) ? LAYER_EXISTS : null);
}

/** The new layer on every street, in the map's order, as the brush would paint each one. */
export function layerStreetRequests(map: WorkMap, workId: string, newEntryId: () => string): WorkScopeRequest[] {
  return map.streets.flatMap((street) => brushRequests(map, { kind: 'work', id: workId }, street.id, newEntryId()));
}

const textOf = (value: unknown) => (typeof value === 'string' && value ? value : null);

/** The id Portal gave the new tag, when the tool's answer carries it. */
export function tagIdOfAnswer(answer: Record<string, unknown> | undefined): string | null {
  if (!answer) return null;
  const nested = answer.tag && typeof answer.tag === 'object' ? (answer.tag as Record<string, unknown>) : {};
  return textOf(answer.tag_id) ?? textOf(answer.tagId) ?? textOf(answer._id) ?? textOf(answer.id) ?? textOf(nested._id) ?? textOf(nested.id);
}

/** The work the map gained under that name: what a reload shows when the answer had no id. */
export function newWorkIdOf(before: Pick<WorkMap, 'works'>, after: Pick<WorkMap, 'works'>, name: string): string | null {
  const known = new Set(before.works.map((work) => work.id));
  const folded = foldLayerName(name);
  return after.works.find((work) => !known.has(work.id) && !work.partida && foldLayerName(work.name) === folded)?.id ?? null;
}

type LayerDeps = { send: MapEditSend; newEntryId: () => string; /** Looks in the maps the reloads bring; null when none had it in time. */ findInMap: (pick: (map: WorkMap) => string | null) => Promise<string | null> };

/** Sends the street requests one by one; the first refusal stops and is what the person reads. */
async function assignAll(requests: WorkScopeRequest[], send: MapEditSend): Promise<string | null> {
  for (const request of requests) {
    const answer: WorkProgressResult = await send(request, sendWorkScope);
    if (!answer.ok) return answer.message;
  }
  return null;
}

/** «Crear capa»: the tag, then (switch on) every street; null failure when all of it was kept. */
export async function runLayerCreate(map: WorkMap, plan: LayerPlan | null, deps: LayerDeps): Promise<LayerCreated> {
  const problem = layerPlanProblem(map, plan);
  if (problem || !plan) return { failure: problem ?? LAYER_PICK_ONE, workId: null, paint: false };
  const created = await deps.send(workTagRequest(plan.name, plan.color), sendWorkTag);
  if (!created.ok) return { failure: created.message, workId: null, paint: false };
  const workId = tagIdOfAnswer(created.data) ?? (await deps.findInMap((after) => newWorkIdOf(map, after, plan.name)));
  if (!workId) return { failure: LAYER_NOT_FOUND, workId: null, paint: false };
  if (!plan.allStreets) return { failure: null, workId, paint: true };
  return { failure: await assignAll(layerStreetRequests(map, workId, deps.newEntryId), deps.send), workId, paint: false };
}

/**
 * Finds something in the map as reloads bring it, for code that cannot wait on a render: `offer`
 * the map every time it changes; `find` answers from the latest one or from the next that has it.
 */
export function createMapWaiter(timeoutMs: number) {
  let latest: WorkMap | null = null;
  let check: ((map: WorkMap) => boolean) | null = null;
  const offer = (map: WorkMap) => {
    latest = map;
    if (check?.(map)) check = null;
  };
  const find = (pick: (map: WorkMap) => string | null): Promise<string | null> => {
    const now = latest ? pick(latest) : null;
    if (now !== null) return Promise.resolve(now);
    return new Promise((resolve) => {
      const timer = setTimeout(() => { check = null; resolve(null); }, timeoutMs);
      check = (map) => {
        const found = pick(map);
        if (found === null) return false;
        clearTimeout(timer);
        resolve(found);
        return true;
      };
    });
  };
  return { offer, find };
}

/** How long «Crear capa» waits for the map to show the new layer before saying so. */
export const LAYER_MAP_WAIT_MS = 15_000;

/** «Crear capa Imprimación» on the button, «Crear capa» while nothing is picked. */
export const layerButtonLabel = (plan: LayerPlan | null, busy: boolean): string => (busy ? 'Creando…' : plan?.name.trim() ? `Crear capa ${plan.name.trim()}` : 'Crear capa');

/** What the screen holds: the chip picked (or «Otra…» with its name and color) and the switch. */
export type LayerPick = { key: string | null; otherName: string; otherColor: string; allStreets: boolean };
export const layerPickIdle = (): LayerPick => ({ key: null, otherName: '', otherColor: OTHER_LAYER_COLOR, allStreets: true });

/** The plan «Crear capa» sends for what is picked; null while nothing is. */
export function layerPlanOf(pick: LayerPick): LayerPlan | null {
  if (pick.key === OTHER_LAYER_KEY) return { name: pick.otherName, color: pick.otherColor, allStreets: pick.allStreets };
  const entry = LAYER_CATALOG.find((one) => one.key === pick.key);
  return entry ? { name: entry.name, color: entry.color, allStreets: pick.allStreets } : null;
}

import { dayMonthOf } from './appDirectory.js';
import { metersLabel, projectOntoLine, sliceLine, workMapView, type WorkMap, type WorkMapLine, type WorkMapPoint, type WorkMapScope } from './workMap.js';
import type { WorkProgressResult } from './workProgressSend.js';
import { WORK_TAG_COLORS, workScopeDeleteRequest, workScopeRequest, type ScopeDraft, type WorkScopeDeleteRequest, type WorkScopeRequest } from './workScopeDraft.js';

/**
 * «Etapas» (design o-04) and «Trabajos» (o-05), audit 08/11 item 2: what each stage and work
 * covers, and the BRUSH that paints them on streets with a tap instead of stretch by stretch. A
 * tap toggles: the street takes the stage or work, or leaves it if it already had it. PURE: the
 * web and the APK draw and send from here; Portal's map tools check every request again.
 */
export type StreetRef = { id: string; name: string; lengthM: number };
export type StageCard = { id: string; name: string; streets: StreetRef[]; lengthM: number; areaM2: number; percent: number; line: string; days: string };
/** `editable`: a tag of the map; a contract item is not renamed nor deleted from it. */
export type WorkRow = { id: string; name: string; color: string; order: number; streets: number; lengthM: number; line: string; editable: boolean };
export type Brush = { kind: 'stage' | 'work'; id: string };
/** A tap's stretches; «Deshacer» of a stretch the brush created deletes it (Portal keeps it in «Borrados»). */
export type BrushRequest = WorkScopeRequest | WorkScopeDeleteRequest;

const NO_DAYS = 'Sin jornadas todavía';
const lengthOf = (scopes: WorkMapScope[]) => scopes.reduce((sum, scope) => sum + Math.max(0, scope.toM - scope.fromM), 0);
const countLabel = (count: number) => `${count} ${count === 1 ? 'calle' : 'calles'}`;
const areaLabel = (squareM: number) => `${metersLabel(squareM).replace(/ m$/, '')} m²`;
const dayLabel = (day: string) => dayMonthOf(new Date(`${day}T00:00:00Z`));

function streetsOf(map: WorkMap, scopes: WorkMapScope[]): StreetRef[] {
  return map.streets.filter((street) => scopes.some((scope) => scope.streetId === street.id)).map(({ id, name, lengthM }) => ({ id, name, lengthM }));
}

function areaOf(map: WorkMap, scopes: WorkMapScope[]): number {
  const widthOf = (scope: WorkMapScope) => scope.widthM ?? map.streets.find((street) => street.id === scope.streetId)?.widthM ?? 0;
  return Math.round(scopes.reduce((sum, scope) => sum + Math.max(0, scope.toM - scope.fromM) * widthOf(scope), 0));
}

/** The days with approved work inside the stage's stretches: a stage has no dates of its own. */
function daysOf(map: WorkMap, scopes: WorkMapScope[]): string {
  const inside = (record: WorkMap['progress'][number]) => scopes.some((scope) => scope.streetId === record.streetId && scope.workIds.includes(record.workId) && record.fromM < scope.toM && record.toM > scope.fromM);
  const days = [...new Set(map.progress.filter(inside).map((record) => record.date))].sort();
  const [first, last] = [days[0], days[days.length - 1]];
  if (!first || !last) return NO_DAYS;
  return first === last ? `Jornada del ${dayLabel(first)}` : `Jornadas del ${dayLabel(first)} al ${dayLabel(last)}`;
}

/** One card per stage, in Portal's order, and the streets that belong to none. */
export function stageCardsOf(map: WorkMap): { cards: StageCard[]; loose: StreetRef[] } {
  const cards = map.stages.map((stage): StageCard => {
    const scopes = map.scopes.filter((scope) => scope.stageId === stage.id);
    const streets = streetsOf(map, scopes);
    const lengthM = lengthOf(scopes);
    const areaM2 = areaOf(map, scopes);
    const percent = scopes.length ? workMapView(map, { stageId: stage.id }).percent : 0;
    return { id: stage.id, name: stage.name, streets, lengthM, areaM2, percent, line: `${countLabel(streets.length)} · ${metersLabel(lengthM)} · ${areaLabel(areaM2)}`, days: daysOf(map, scopes) };
  });
  const staged = (streetId: string) => map.scopes.some((scope) => scope.streetId === streetId && map.stages.some((stage) => stage.id === scope.stageId));
  const loose = map.streets.filter((street) => !staged(street.id)).map(({ id, name, lengthM }) => ({ id, name, lengthM }));
  return { cards, loose };
}

/** The works in their order (o-05 numbers them), with how much of the map each one covers. */
export function workRowsOf(map: WorkMap): WorkRow[] {
  return map.works.map((work, index) => {
    const scopes = map.scopes.filter((scope) => scope.workIds.includes(work.id));
    const streets = new Set(scopes.map((scope) => scope.streetId)).size;
    const lengthM = lengthOf(scopes);
    return { id: work.id, name: work.name, color: work.color, order: index + 1, streets, lengthM, line: `${countLabel(streets)} · ${metersLabel(lengthM)}`, editable: !work.partida };
  });
}

const scopeHas = (scope: WorkMapScope, brush: Brush) => (brush.kind === 'stage' ? scope.stageId === brush.id : scope.workIds.includes(brush.id));
const scopesOf = (map: Pick<WorkMap, 'scopes'>, streetId: string) => map.scopes.filter((scope) => scope.streetId === streetId);

/** Whether the street already carries the brush on every stretch: the map paints it so. */
export function brushHas(map: Pick<WorkMap, 'scopes'>, brush: Brush, streetId: string): boolean {
  const scopes = scopesOf(map, streetId);
  return scopes.length > 0 && scopes.every((scope) => scopeHas(scope, brush));
}

const draftOf = (scope: WorkMapScope): ScopeDraft => ({ fromM: scope.fromM, toM: scope.toM, workIds: scope.workIds, stageId: scope.stageId ?? null, widthM: scope.widthM ?? null });

function painted(draft: ScopeDraft, brush: Brush, on: boolean): ScopeDraft {
  if (brush.kind === 'stage') return { ...draft, stageId: on ? brush.id : null };
  const others = draft.workIds.filter((id) => id !== brush.id);
  return { ...draft, workIds: on ? [...others, brush.id] : others };
}

export const BRUSH_LAST_WORK = 'Es lo único que tiene esta calle. Para quitarlo, borra el tramo en «Ver tramos».';

/** A stretch keeps a work or its stage (Portal, 08/11): the tap that would leave one empty is refused here. */
export function brushProblem(map: Pick<WorkMap, 'scopes'>, brush: Brush, streetId: string): string | null {
  if (!brushHas(map, brush, streetId)) return null;
  const emptied = (scope: WorkMapScope) => (brush.kind === 'stage' ? scope.workIds.length === 0 : scope.workIds.length <= 1 && !scope.stageId);
  return scopesOf(map, streetId).some(emptied) ? BRUSH_LAST_WORK : null;
}

/** What a tap on the street sends: the brush on all its stretches, or off if it had it on all. */
export function brushRequests(map: WorkMap, brush: Brush, streetId: string, entryId: string): WorkScopeRequest[] {
  const street = map.streets.find((one) => one.id === streetId);
  if (!street || brushProblem(map, brush, streetId)) return [];
  const scopes = scopesOf(map, streetId);
  if (!scopes.length) {
    const whole: ScopeDraft = { fromM: 0, toM: Math.round(street.lengthM), workIds: [], stageId: null, widthM: null };
    return [workScopeRequest(map, streetId, painted(whole, brush, true), entryId)];
  }
  const on = !brushHas(map, brush, streetId);
  return scopes.map((scope) => workScopeRequest(map, streetId, painted(draftOf(scope), brush, on), entryId, scope.id));
}

/** «Deshacer»: the street's stretches as they were before the tap; one the tap created is deleted. */
export function brushUndoRequests(before: WorkMap, after: WorkMap, streetId: string): BrushRequest[] {
  return scopesOf(after, streetId).map((scope) => {
    const old = before.scopes.find((one) => one.id === scope.id);
    return old ? workScopeRequest(after, streetId, draftOf(old), '', scope.id) : workScopeDeleteRequest(scope.id);
  });
}

/** How far from a street's axis a tap still means that street: a finger on a phone misses by a lane or two. */
export const BRUSH_REACH_M = 30;

/** The street of the work under a tap, the nearest within reach; null when the tap is off every street. */
export function streetAtTap(map: Pick<WorkMap, 'streets'>, place: WorkMapPoint): string | null {
  const feet = map.streets.flatMap((street) => {
    const foot = street.line.length >= 2 ? projectOntoLine(street.line, place) : null;
    return foot && foot.distanceM <= BRUSH_REACH_M ? [{ id: street.id, distanceM: foot.distanceM }] : [];
  });
  feet.sort((left, right) => left.distanceM - right.distanceM);
  return feet[0]?.id ?? null;
}

/** A stage has no color of its own in Portal: the brush paints it violet. MapLibre paints hex. */
export const BRUSH_STAGE_COLOR: string = WORK_TAG_COLORS[5];
export const BRUSH_OFF_STREET = 'Toca sobre una calle de la obra.';
export const BRUSH_NO_EDIT = 'Sin permiso para editar el mapa.';

/** The stretches that carry the brush, thick over the map: what is already painted. */
export function brushLinesOf(map: WorkMap, brush: Brush): WorkMapLine[] {
  const color = brush.kind === 'stage' ? BRUSH_STAGE_COLOR : map.works.find((work) => work.id === brush.id)?.color ?? BRUSH_STAGE_COLOR;
  return map.scopes.filter((scope) => scopeHas(scope, brush)).flatMap((scope) => {
    const line = map.streets.find((street) => street.id === scope.streetId)?.line ?? [];
    const coordinates = sliceLine(line, scope.fromM, scope.toM).map((point): [number, number] => [point.lng, point.lat]);
    return coordinates.length >= 2 ? [{ streetId: scope.streetId, color, coordinates, fromM: scope.fromM, toM: scope.toM }] : [];
  });
}

/** The band over the map while the brush is on (o-04, o-05). */
export function brushTitle(map: WorkMap, brush: Brush): string {
  if (brush.kind === 'stage') return `Toca las calles en el mapa para sumarlas a ${map.stages.find((stage) => stage.id === brush.id)?.name ?? 'la etapa'}`;
  return `Pintando ${map.works.find((work) => work.id === brush.id)?.name ?? 'el trabajo'} · Toca las calles que la llevan`;
}

/** Sends a tap's stretches one by one; the first refusal stops and is what the person reads. */
export async function runBrushRequests(send: (request: BrushRequest) => Promise<WorkProgressResult>, requests: BrushRequest[]): Promise<string | null> {
  if (!requests.length) return BRUSH_OFF_STREET;
  for (const request of requests) {
    const result = await send(request);
    if (!result.ok) return result.message;
  }
  return null;
}

/** One tap the brush made, so «Deshacer» can put the street back. */
export type BrushStroke = { before: WorkMap; brush: Brush; streetId: string };
type ScopeSend = (request: BrushRequest) => Promise<WorkProgressResult>;

/**
 * A tap in brush mode: the street under it toggled through Portal, and the stroke to undo it.
 * `newEntryId` keys a new stretch: Portal takes only a UUID (web E2E 08/11: «brocha-<ms>» was refused).
 */
export async function paintAt(map: WorkMap, brush: Brush, place: WorkMapPoint, send: ScopeSend, newEntryId: () => string): Promise<{ failure: string | null; stroke: BrushStroke | null }> {
  const streetId = streetAtTap(map, place);
  const problem = streetId ? brushProblem(map, brush, streetId) : null;
  if (problem) return { failure: problem, stroke: null };
  const failure = await runBrushRequests(send, streetId ? brushRequests(map, brush, streetId, newEntryId()) : []);
  return { failure, stroke: !failure && streetId ? { before: map, brush, streetId } : null };
}

/** «Deshacer»: the stroke's street as it was, against the map Portal shows now. */
export const undoStroke = (stroke: BrushStroke, current: WorkMap, send: ScopeSend): Promise<string | null> =>
  runBrushRequests(send, brushUndoRequests(stroke.before, current, stroke.streetId));

import type { WorkMap, WorkMapPoint, WorkMapScope } from './workMap.js';
import type { WorkProgressResult } from './workProgressSend.js';
import { sendWorkScope, type MapEditSend } from './workScopeDraft.js';
import { BRUSH_NO_EDIT, BRUSH_OFF_STREET, brushHas, brushProblem, brushRequests, runBrushRequests, streetAtTap, undoStroke, type Brush, type BrushRequest, type BrushStroke } from './workMapBrush.js';

/**
 * The brush without waiting (José 28/11: each tap blocked until Portal saved it, street by
 * street). A tap paints the street at once and queues its save; the saves go to Portal one at a
 * time, in the order of the taps, behind the map. PURE of any UI: the APK and the web hold one queue
 * per brush and redraw from `mapOf` and `snapshot`.
 *
 * - Each save is computed when its turn comes, against the map Portal answered last, so a street
 *   saved earlier in the session is read with its new stretch (`freshMap`).
 * - A new stretch keeps the entry id of its tap: a retry is never a second stretch.
 * - A second tap on a street still queued takes it back (nothing is sent); on one being saved it
 *   does nothing. Never two saves of one tap.
 * - «Deshacer» walks back the last tap: dropped if queued, sent back as it was once saved.
 * - A refused save un-paints its street and its reason shows once, until the next tap.
 */
type Phase = 'queued' | 'saving' | 'saved' | 'undo-queued' | 'undoing' | 'undone' | 'failed';
type Tap = { streetId: string; on: boolean; entryId: string; phase: Phase; stroke: BrushStroke | null };
type Job = { kind: 'save' | 'undo'; tap: Tap };
type ScopeSend = (request: BrushRequest) => Promise<WorkProgressResult>;

export type BrushQueueSnapshot = { busy: boolean; label: string | null; error: string | null; canUndo: boolean };
export type BrushQueueDeps = {
  brush: Brush;
  /** The map Portal answered when the brush opened; later ones arrive through `mapChanged`. */
  map: WorkMap;
  send: ScopeSend;
  newEntryId: () => string;
  onChange: (snapshot: BrushQueueSnapshot) => void;
  /** How long a save waits for the reloaded map before going on with the one it has. */
  freshWaitMs?: number;
};
export type BrushQueue = {
  tap: (place: WorkMapPoint) => void;
  undo: () => void;
  mapChanged: (map: WorkMap) => void;
  /** The map as the person sees it: Portal's, with the taps on top. */
  mapOf: (map: WorkMap) => WorkMap;
  snapshot: () => BrushQueueSnapshot;
  /** Resolves when nothing is left to send. */
  idle: () => Promise<void>;
};

/** A reload after a save usually lands well within this; past it the save goes on with what it has. */
export const BRUSH_FRESH_MAP_WAIT_MS = 2000;
const WAITING: ReadonlySet<Phase> = new Set(['queued', 'saving', 'undo-queued', 'undoing']);
const PAINTED: ReadonlySet<Phase> = new Set(['queued', 'saving', 'saved']);
const UNDOABLE: ReadonlySet<Phase> = new Set(['queued', 'saving', 'saved']);
const streetsLabel = (count: number) => `${count} ${count === 1 ? 'calle' : 'calles'}`;

/** The counter: N streets while saving, N streets saved after; nothing before the first tap. */
export function brushQueueLabel(count: number, busy: boolean): string | null {
  if (busy) return `${streetsLabel(count)} · guardando…`;
  if (!count) return null;
  return `${streetsLabel(count)} ${count === 1 ? 'guardada' : 'guardadas'}`;
}

function paintedScope(scope: WorkMapScope, brush: Brush, on: boolean): WorkMapScope {
  if (brush.kind === 'stage') return on ? { ...scope, stageId: brush.id } : { ...scope, stageId: undefined };
  const others = scope.workIds.filter((id) => id !== brush.id);
  return { ...scope, workIds: on ? [...others, brush.id] : others };
}

/** The street with the brush on or off on every stretch; a street without stretches gets one along all of it. */
function withStreet(map: WorkMap, brush: Brush, streetId: string, on: boolean): WorkMap {
  const own = map.scopes.filter((scope) => scope.streetId === streetId);
  const street = map.streets.find((one) => one.id === streetId);
  if (!own.length) {
    if (!on || !street) return map;
    const whole: WorkMapScope = { id: `brush-${streetId}`, streetId, fromM: 0, toM: street.lengthM, workIds: [] };
    return { ...map, scopes: [...map.scopes, paintedScope(whole, brush, true)] };
  }
  return { ...map, scopes: map.scopes.map((scope) => (scope.streetId === streetId ? paintedScope(scope, brush, on) : scope)) };
}

type QueueState = {
  deps: BrushQueueDeps;
  waitMs: number;
  latest: WorkMap;
  /** Bumped by every map Portal answers; `touched` keeps the one each street's last save needs. */
  version: number;
  error: string | null;
  running: boolean;
  taps: Tap[];
  jobs: Job[];
  mapWaiters: Array<() => void>;
  idleWaiters: Array<() => void>;
  touched: Map<string, number>;
};

const isBusy = (state: QueueState) => state.taps.some((one) => WAITING.has(one.phase));

function snapshotOf(state: QueueState): BrushQueueSnapshot {
  const count = state.taps.filter((one) => PAINTED.has(one.phase)).length;
  const busy = isBusy(state);
  return { busy, label: brushQueueLabel(count, busy), error: state.error, canUndo: state.taps.some((one) => UNDOABLE.has(one.phase)) };
}

function changed(state: QueueState): void {
  state.deps.onChange(snapshotOf(state));
  if (!isBusy(state)) state.idleWaiters.splice(0).forEach((resolve) => resolve());
}

const mapOfTaps = (state: QueueState, map: WorkMap): WorkMap => state.taps.reduce((shown, one) => {
  if (one.phase === 'failed') return shown;
  return withStreet(shown, state.deps.brush, one.streetId, PAINTED.has(one.phase) ? one.on : !one.on);
}, map);

/** The map after the reload of the street's earlier saves; past the wait, the one it has. */
function freshMap(state: QueueState, streetId: string): Promise<WorkMap> {
  const needed = state.touched.get(streetId) ?? 0;
  if (state.version >= needed) return Promise.resolve(state.latest);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(state.latest), state.waitMs);
    const wake = () => {
      if (state.version < needed) return void state.mapWaiters.push(wake);
      clearTimeout(timer);
      resolve(state.latest);
    };
    state.mapWaiters.push(wake);
  });
}

const sentOn = (state: QueueState, streetId: string) => state.touched.set(streetId, state.version + 1);

async function saveTap(state: QueueState, tap: Tap): Promise<void> {
  const { brush, send } = state.deps;
  const map = await freshMap(state, tap.streetId);
  const wanted = brushHas(map, brush, tap.streetId) === tap.on ? [] : brushRequests(map, brush, tap.streetId, tap.entryId);
  const failure = wanted.length ? await runBrushRequests(send, wanted) : null;
  if (wanted.length) sentOn(state, tap.streetId);
  if (failure) {
    tap.phase = 'failed';
    state.error = failure;
    return;
  }
  tap.stroke = { before: map, brush, streetId: tap.streetId };
  if (tap.phase === 'saving') tap.phase = 'saved';
}

async function revertTap(state: QueueState, tap: Tap): Promise<void> {
  if (tap.phase === 'failed' || !tap.stroke) return;
  tap.phase = 'undoing';
  changed(state);
  const current = await freshMap(state, tap.streetId);
  const failure = await undoStroke(tap.stroke, current, state.deps.send);
  sentOn(state, tap.streetId);
  tap.phase = failure ? 'saved' : 'undone';
  if (failure) state.error = failure;
}

async function pump(state: QueueState): Promise<void> {
  if (state.running) return;
  state.running = true;
  for (let job = state.jobs.shift(); job; job = state.jobs.shift()) {
    if (job.kind === 'save') {
      if (job.tap.phase === 'queued') job.tap.phase = 'saving';
      changed(state);
      await saveTap(state, job.tap);
    } else await revertTap(state, job.tap);
    changed(state);
  }
  state.running = false;
}

function dropQueued(state: QueueState, one: Tap): void {
  state.taps.splice(state.taps.indexOf(one), 1);
  const job = state.jobs.findIndex((candidate) => candidate.tap === one);
  if (job >= 0) state.jobs.splice(job, 1);
  changed(state);
}

function enqueue(state: QueueState, job: Job): void {
  state.jobs.push(job);
  changed(state);
  void pump(state);
}

/** A tap: a new street queued, a queued one taken back, one being saved left alone. */
function tapAt(state: QueueState, place: WorkMapPoint): void {
  const { brush } = state.deps;
  const shown = mapOfTaps(state, state.latest);
  const streetId = streetAtTap(shown, place);
  state.error = streetId ? null : BRUSH_OFF_STREET;
  const open = streetId ? state.taps.find((one) => one.streetId === streetId && WAITING.has(one.phase)) : undefined;
  if (open) return open.phase === 'queued' ? dropQueued(state, open) : changed(state);
  state.error = streetId ? brushProblem(shown, brush, streetId) : state.error;
  if (!streetId || state.error) return changed(state);
  const one: Tap = { streetId, on: !brushHas(shown, brush, streetId), entryId: state.deps.newEntryId(), phase: 'queued', stroke: null };
  state.taps.push(one);
  enqueue(state, { kind: 'save', tap: one });
}

/** «Deshacer»: the last tap, dropped if still queued, else sent back after its save. */
function undoLast(state: QueueState): void {
  state.error = null;
  const last = [...state.taps].reverse().find((one) => UNDOABLE.has(one.phase));
  if (!last) return changed(state);
  if (last.phase === 'queued') return dropQueued(state, last);
  last.phase = 'undo-queued';
  enqueue(state, { kind: 'undo', tap: last });
}

function mapChangedTo(state: QueueState, map: WorkMap): void {
  if (map === state.latest) return;
  state.latest = map;
  state.version += 1;
  state.mapWaiters.splice(0).forEach((wake) => wake());
}

export function createBrushQueue(deps: BrushQueueDeps): BrushQueue {
  const state: QueueState = {
    deps, waitMs: deps.freshWaitMs ?? BRUSH_FRESH_MAP_WAIT_MS, latest: deps.map, version: 0, error: null,
    running: false, taps: [], jobs: [], mapWaiters: [], idleWaiters: [], touched: new Map(),
  };
  return {
    tap: (place) => tapAt(state, place),
    undo: () => undoLast(state),
    mapChanged: (map) => mapChangedTo(state, map),
    mapOf: (map) => mapOfTaps(state, map),
    snapshot: () => snapshotOf(state),
    idle: () => (isBusy(state) ? new Promise((resolve) => state.idleWaiters.push(resolve)) : Promise.resolve()),
  };
}

/** Before the first tap: nothing to say, nothing to undo. */
export const BRUSH_QUEUE_IDLE: BrushQueueSnapshot = { busy: false, label: null, error: null, canUndo: false };

export type BrushQueueStart = Omit<BrushQueueDeps, 'send'> & { /** The map's door as it is now; none means no permission to edit. */ send: () => MapEditSend | undefined };

/** The queue the APK and the web open with the brush: each save through the map's door as a stretch. */
export function startBrushQueue(start: BrushQueueStart): BrushQueue {
  return createBrushQueue({
    ...start,
    send: (request) => {
      const edit = start.send();
      return edit ? edit(request, sendWorkScope) : Promise.resolve({ ok: false, message: BRUSH_NO_EDIT });
    },
  });
}

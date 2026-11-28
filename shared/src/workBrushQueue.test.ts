import { describe, expect, it } from 'vitest';
import type { WorkMap } from './workMap.js';
import type { WorkProgressResult } from './workProgressSend.js';
import { brushHas, type Brush, type BrushRequest } from './workMapBrush.js';
import type { MapEditSend } from './workScopeDraft.js';
import { BRUSH_QUEUE_IDLE, brushQueueLabel, createBrushQueue, startBrushQueue, type BrushQueueSnapshot } from './workBrushQueue.js';

/** José 28/11: every tap paints at once; the saves go in order behind it. */
const lineAt = (lat: number) => [{ lat, lng: -77 }, { lat, lng: -76.999 }];
const MAP: WorkMap = {
  streets: [
    { id: 's1', name: 'Av. Los Incas', line: lineAt(-12), lengthM: 100 },
    { id: 's2', name: 'Jr. Los Pinos', line: lineAt(-12.01), lengthM: 80 },
    { id: 's3', name: 'Calle Tacna', line: lineAt(-12.02), lengthM: 60 },
  ],
  scopes: [{ id: 'c1', streetId: 's1', fromM: 0, toM: 100, workIds: ['base'] }],
  progress: [],
  works: [{ id: 'base', name: 'Base', color: '#d97706' }, { id: 'asf', name: 'Asfalto', color: '#111827' }],
  stages: [],
};
const ASPHALT: Brush = { kind: 'work', id: 'asf' };
const tapOn = (lat: number) => ({ lat, lng: -76.9995 });

type Pending = { request: BrushRequest; resolve: (result: WorkProgressResult) => void };

function harness(options: { fail?: (request: BrushRequest) => string | null } = {}) {
  const pending: Pending[] = [];
  const sent: BrushRequest[] = [];
  const snapshots: BrushQueueSnapshot[] = [];
  let ids = 0;
  const queue = createBrushQueue({
    brush: ASPHALT,
    map: MAP,
    send: (request) => {
      sent.push(request);
      const refusal = options.fail?.(request);
      if (refusal) return Promise.resolve({ ok: false, message: refusal });
      return new Promise((resolve) => pending.push({ request, resolve }));
    },
    newEntryId: () => `00000000-0000-4000-8000-00000000000${++ids}`,
    onChange: (snapshot) => snapshots.push(snapshot),
    freshWaitMs: 0,
  });
  const settle = async () => {
    for (let round = 0; round < 20; round += 1) {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  const answerNext = async () => {
    await settle();
    const next = pending.shift();
    next?.resolve({ ok: true, message: 'Tramo guardado.' });
    await settle();
  };
  return { queue, pending, sent, snapshots, settle, answerNext };
}

const streetsOf = (requests: BrushRequest[]) => requests.map((request) => ('street_id' in request ? request.street_id : `delete:${request.scope_id}`));

describe('createBrushQueue: optimistic taps', () => {
  it('paints each tapped street at once, before any save comes back', () => {
    const { queue } = harness();
    queue.tap(tapOn(-12));
    queue.tap(tapOn(-12.01));
    const shown = queue.mapOf(MAP);
    expect(brushHas(shown, ASPHALT, 's1')).toBe(true);
    expect(brushHas(shown, ASPHALT, 's2')).toBe(true);
    expect(queue.snapshot()).toMatchObject({ busy: true, label: '2 calles · guardando…' });
  });

  it('sends one save at a time, in the order of the taps', async () => {
    const { queue, sent, answerNext, settle } = harness();
    queue.tap(tapOn(-12.01));
    queue.tap(tapOn(-12));
    queue.tap(tapOn(-12.02));
    await settle();
    expect(streetsOf(sent)).toEqual(['s2']);
    await answerNext();
    expect(streetsOf(sent)).toEqual(['s2', 's1']);
    await answerNext();
    await answerNext();
    expect(streetsOf(sent)).toEqual(['s2', 's1', 's3']);
    expect(queue.snapshot()).toMatchObject({ busy: false, label: '3 calles guardadas', error: null });
  });

  it('keeps the entry id of each new stretch, so a retry is never a second one', async () => {
    const { queue, sent, settle } = harness();
    queue.tap(tapOn(-12.01));
    await settle();
    expect(sent[0]).toMatchObject({ street_id: 's2', entry_id: '00000000-0000-4000-8000-000000000001' });
  });

  it('a second tap on a street still waiting takes it back and never saves it', async () => {
    const { queue, sent, answerNext, settle } = harness();
    queue.tap(tapOn(-12));
    queue.tap(tapOn(-12.01));
    queue.tap(tapOn(-12.01));
    expect(brushHas(queue.mapOf(MAP), ASPHALT, 's2')).toBe(false);
    await answerNext();
    await settle();
    expect(streetsOf(sent)).toEqual(['s1']);
    expect(queue.snapshot().label).toBe('1 calle guardada');
  });

  it('a second tap on the street being saved does nothing: no duplicate save', async () => {
    const { queue, sent, settle, answerNext } = harness();
    queue.tap(tapOn(-12.01));
    await settle();
    queue.tap(tapOn(-12.01));
    await answerNext();
    expect(streetsOf(sent)).toEqual(['s2']);
    expect(brushHas(queue.mapOf(MAP), ASPHALT, 's2')).toBe(true);
  });

  it('a tap off every street says so and queues nothing', () => {
    const { queue, sent } = harness();
    queue.tap({ lat: -11, lng: -70 });
    expect(queue.snapshot().error).toBe('Toca sobre una calle de la obra.');
    expect(sent).toEqual([]);
  });
});

describe('createBrushQueue: failures and undo', () => {
  it('a refused save un-paints that street, shows the reason once and the rest goes on', async () => {
    const { queue, sent, settle, answerNext } = harness({ fail: (request) => ('street_id' in request && request.street_id === 's2' ? 'El tramo excede el largo de la calle.' : null) });
    queue.tap(tapOn(-12.01));
    queue.tap(tapOn(-12.02));
    await settle();
    expect(brushHas(queue.mapOf(MAP), ASPHALT, 's2')).toBe(false);
    expect(queue.snapshot().error).toBe('El tramo excede el largo de la calle.');
    await answerNext();
    expect(streetsOf(sent)).toEqual(['s2', 's3']);
    expect(queue.snapshot()).toMatchObject({ label: '1 calle guardada', error: 'El tramo excede el largo de la calle.' });
    queue.tap(tapOn(-12));
    expect(queue.snapshot().error).toBeNull();
  });

  it('«Deshacer» on a street still in the queue drops it without sending', async () => {
    const { queue, sent, settle, answerNext } = harness();
    queue.tap(tapOn(-12));
    queue.tap(tapOn(-12.01));
    queue.undo();
    expect(brushHas(queue.mapOf(MAP), ASPHALT, 's2')).toBe(false);
    await answerNext();
    await settle();
    expect(streetsOf(sent)).toEqual(['s1']);
    expect(queue.snapshot()).toMatchObject({ label: '1 calle guardada', canUndo: true });
  });

  it('«Deshacer» on a saved street sends it back as it was, in turn', async () => {
    const { queue, sent, answerNext } = harness();
    queue.tap(tapOn(-12));
    await answerNext();
    queue.undo();
    expect(brushHas(queue.mapOf(MAP), ASPHALT, 's1')).toBe(false);
    await answerNext();
    expect(sent[1]).toMatchObject({ kind: 'work_scope', street_id: 's1', scope_id: 'c1', tag_ids: ['base'] });
    expect(queue.snapshot()).toMatchObject({ busy: false, label: null, canUndo: false });
  });

  it('«Deshacer» on the street being saved waits for the save, then undoes it', async () => {
    const { queue, sent, settle, answerNext } = harness();
    queue.tap(tapOn(-12));
    await settle();
    queue.undo();
    expect(brushHas(queue.mapOf(MAP), ASPHALT, 's1')).toBe(false);
    await answerNext();
    await answerNext();
    expect(sent).toHaveLength(2);
    expect(queue.snapshot().canUndo).toBe(false);
  });

  it('a street saved before is read again from the reloaded map, never from the stale one', async () => {
    const { queue, sent, answerNext, settle } = harness();
    queue.tap(tapOn(-12));
    await answerNext();
    queue.tap(tapOn(-12));
    queue.mapChanged({ ...MAP, scopes: [{ id: 'c1', streetId: 's1', fromM: 0, toM: 100, workIds: ['base', 'asf'] }] });
    await settle();
    expect(sent[1]).toMatchObject({ street_id: 's1', scope_id: 'c1', tag_ids: ['base'] });
  });

  it('idle() resolves once the queue is empty', async () => {
    const { queue, answerNext } = harness();
    queue.tap(tapOn(-12));
    let drained = false;
    void queue.idle().then(() => { drained = true; });
    await Promise.resolve();
    expect(drained).toBe(false);
    await answerNext();
    expect(drained).toBe(true);
  });
});

describe('brushQueueLabel', () => {
  it('says nothing before the first tap', () => {
    expect(brushQueueLabel(0, false)).toBeNull();
  });
});

describe('startBrushQueue', () => {
  it('without the map door each save is refused as no permission, and the street un-paints', async () => {
    const queue = startBrushQueue({ brush: ASPHALT, map: MAP, send: () => undefined, newEntryId: () => 'k', onChange: () => undefined, freshWaitMs: 0 });
    queue.tap(tapOn(-12.01));
    await queue.idle();
    expect(queue.snapshot().error).toBe('Sin permiso para editar el mapa.');
    expect(brushHas(queue.mapOf(MAP), ASPHALT, 's2')).toBe(false);
  });

  it('sends each stretch through the door with the stretch texts', async () => {
    const calls: string[] = [];
    const door: MapEditSend = async (request) => { calls.push(request.kind); return { ok: true, message: 'ok' }; };
    const queue = startBrushQueue({ brush: ASPHALT, map: MAP, send: () => door, newEntryId: () => 'k', onChange: () => undefined, freshWaitMs: 0 });
    queue.tap(tapOn(-12));
    await queue.idle();
    expect(calls).toEqual(['work_scope']);
    expect(queue.snapshot()).toEqual({ ...BRUSH_QUEUE_IDLE, label: '1 calle guardada', canUndo: true });
  });
});

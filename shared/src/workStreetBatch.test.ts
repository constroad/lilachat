import { describe, expect, it } from 'vitest';
import { EMPTY_STREET, type StreetDraft } from './workStreetDraft.js';
import type { WorkMapStreet } from './workMap.js';
import type { WorkProgressResult } from './workProgressSend.js';
import {
  addHandStreet, BATCH_EMPTY, BATCH_NO_STREET, batchCountLabel, batchDoneLabel, batchLines, batchPins, batchProblem, batchRequests, batchSaveLabel, batchTotals,
  EMPTY_BATCH, editBatchStreet, removeBatchStreet, sameStreetLine, saveStreetBatch, tapStreetBatch, type StreetBatch,
} from './workStreetBatch.js';

/** ma02 (José approved the prototype 28/11): tap the roads of the area, one list, one «Listo». */
const M_PER_DEG_LAT = 111_195;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((12 * Math.PI) / 180);
const east = (meters: number, northM = 0) => ({ lat: -12 + northM / M_PER_DEG_LAT, lng: -77 + meters / M_PER_DEG_LNG });
const north = (meters: number) => east(200, meters);
const line = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => ({ type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] });
const pinos = { properties: { class: 'minor', name: 'Jr. Los Pinos' }, geometry: line(east(0), east(500)) };
const monje = { properties: { class: 'minor', name: 'Jr. Monje' }, geometry: line(north(-150), north(150)) };
const onPinos = (meters: number) => ({ underFinger: [pinos], nearby: [pinos, monje], tap: east(meters) });
const onMonje = (meters: number) => ({ underFinger: [monje], nearby: [pinos, monje], tap: north(meters) });
const nowhere = { underFinger: [], nearby: [], tap: east(0, 900) };

const added = (batch: StreetBatch, at: Parameters<typeof tapStreetBatch>[1], key: string, saved: WorkMapStreet[] = []): StreetBatch => {
  const tapped = tapStreetBatch(batch, at, saved, key);
  if (tapped.kind !== 'changed') throw new Error(`expected a change, got ${tapped.kind}`);
  return tapped.batch;
};

describe('tapping roads of the base map', () => {
  it('a tap adds the road whole with its map name, numbered in the order tapped', () => {
    const batch = added(added(EMPTY_BATCH, onPinos(100), 'k1'), onMonje(40), 'k2');
    expect(batch.streets.map((street) => street.name)).toEqual(['Jr. Los Pinos', 'Jr. Monje']);
    expect(batchPins(batch).map((pin) => pin.label)).toEqual(['1', '2']);
    expect(batchTotals(batch)).toEqual({ count: 2, lengthM: 800, label: '2 calles · 800 m' });
  });

  it('a tap on a numbered road takes it out, and the rest renumber', () => {
    const two = added(added(EMPTY_BATCH, onPinos(100), 'k1'), onMonje(40), 'k2');
    const tapped = tapStreetBatch(two, onPinos(400), [], 'k3');
    expect(tapped).toMatchObject({ kind: 'changed' });
    if (tapped.kind !== 'changed') return;
    expect(tapped.batch.streets.map((street) => street.key)).toEqual(['k2']);
    expect(batchPins(tapped.batch)[0]?.label).toBe('1');
  });

  it('taking out a road with a new name or a width asks first', () => {
    const named = editBatchStreet(added(EMPTY_BATCH, onPinos(100), 'k1'), 'k1', { widthM: 6 });
    const tapped = tapStreetBatch(named, onPinos(300), [], 'k2');
    expect(tapped).toEqual({ kind: 'confirm', key: 'k1', question: '«Jr. Los Pinos» tiene cambios. ¿Quitarla de la lista?' });
    expect(removeBatchStreet(named, 'k1')).toEqual(EMPTY_BATCH);
  });

  it('a road already saved in the work is not added twice, even if saved as a stretch of it', () => {
    const saved: WorkMapStreet[] = [{ id: 's1', name: 'Los Pinos cuadra 2', line: [east(150), east(300)], lengthM: 150 }];
    expect(tapStreetBatch(EMPTY_BATCH, onPinos(200), saved, 'k1')).toEqual({ kind: 'problem', message: '«Los Pinos cuadra 2» ya está en la obra.' });
  });

  it('a saved road that only crosses the tapped one does not block it', () => {
    const saved: WorkMapStreet[] = [{ id: 's1', name: 'Jr. Monje', line: [north(-150), north(150)], lengthM: 300 }];
    expect(tapStreetBatch(EMPTY_BATCH, onPinos(100), saved, 'k1').kind).toBe('changed');
  });

  it('a tap with no road under it says so and changes nothing', () => {
    expect(tapStreetBatch(EMPTY_BATCH, nowhere, [], 'k1')).toEqual({ kind: 'problem', message: BATCH_NO_STREET });
  });
});

describe('the overlap rule', () => {
  it('the same axis, or a piece of it, is the same street; a crossing is not; a short line is not', () => {
    expect(sameStreetLine([east(0), east(500)], [east(500), east(0)])).toBe(true);
    expect(sameStreetLine([east(0), east(500)], [east(100, 5), east(200, 5)])).toBe(true);
    expect(sameStreetLine([east(0), east(500)], [north(-150), north(150)])).toBe(false);
    expect(sameStreetLine([east(0), east(500)], [east(0, 60), east(500, 60)])).toBe(false);
    expect(sameStreetLine([east(0)], [east(0), east(500)])).toBe(false);
  });
});

describe('the list', () => {
  const hand: StreetDraft = { ...EMPTY_STREET, mode: 'hand', name: 'Pasaje 2', widthM: 4, points: [east(0, 300), east(80, 300)] };

  it('«Trazar a mano» comes back as one more item, with its name and width', () => {
    const batch = addHandStreet(added(EMPTY_BATCH, onPinos(100), 'k1'), hand, 'k2');
    expect(batch.streets[1]).toMatchObject({ key: 'k2', name: 'Pasaje 2', widthM: 4, source: 'hand' });
    expect(batchTotals(batch).label).toBe('2 calles · 580 m');
  });

  it('a hand street is taken out by a tap on it when no road is there', () => {
    const batch = addHandStreet(EMPTY_BATCH, { ...hand, widthM: null, name: '' }, 'k1');
    const tapped = tapStreetBatch(batch, { underFinger: [], nearby: [], tap: east(40, 302) }, [], 'k2');
    expect(tapped).toEqual({ kind: 'confirm', key: 'k1', question: '«Sin nombre» tiene cambios. ¿Quitarla de la lista?' });
  });

  it('renaming and a width clear the item\'s error; an empty width is no width', () => {
    let batch = added(EMPTY_BATCH, onPinos(100), 'k1');
    batch = { streets: batch.streets.map((street) => ({ ...street, error: 'Portal dijo no' })) };
    batch = editBatchStreet(batch, 'k1', { name: 'Cuadra 1', widthM: null });
    expect(batch.streets[0]).toMatchObject({ name: 'Cuadra 1', widthM: null });
    expect(batch.streets[0]?.error).toBeUndefined();
    expect(editBatchStreet(batch, 'nope', { name: 'x' })).toBe(batch);
  });

  it('labels: one street, many streets, and the button', () => {
    expect(batchCountLabel(1)).toBe('1 calle');
    expect(batchCountLabel(3)).toBe('3 calles');
    expect(batchDoneLabel(3)).toBe('Listo · 3 calles');
    expect(batchSaveLabel(1, 5)).toBe('Guardando 2 de 5…');
    expect(batchTotals(EMPTY_BATCH).label).toBe('0 calles · 0 m');
  });

  it('the lines on the map are the streets of the list', () => {
    const batch = added(EMPTY_BATCH, onPinos(100), 'k1');
    expect(batchLines(batch)).toHaveLength(1);
    expect(batchLines(batch)[0]?.streetId).toBe('lote-k1');
  });
});

describe('«Listo» checks and builds the requests', () => {
  it('an empty list, a nameless street and a bad width each stop it with the item number', () => {
    expect(batchProblem(EMPTY_BATCH)).toBe(BATCH_EMPTY);
    const batch = added(added(EMPTY_BATCH, onPinos(100), 'k1'), onMonje(40), 'k2');
    expect(batchProblem(batch)).toBeNull();
    expect(batchProblem(editBatchStreet(batch, 'k2', { name: ' ' }))).toBe('Calle 2: Ponle nombre a la calle.');
    expect(batchProblem(editBatchStreet(batch, 'k1', { widthM: 99 }))).toBe('Calle 1: El ancho va de 0,1 a 60 m.');
  });

  it('every street goes with its own stable entry id, so a resend is safe', () => {
    const batch = editBatchStreet(added(EMPTY_BATCH, onPinos(100), 'k1'), 'k1', { widthM: 6 });
    const [request] = batchRequests(batch);
    expect(request).toMatchObject({ kind: 'work_street', name: 'Jr. Los Pinos', width_m: 6, entry_id: 'k1' });
    expect(request?.line).toHaveLength(2);
    expect(batchRequests(batch)[0]?.entry_id).toBe('k1');
  });
});

describe('saving one by one', () => {
  const two = () => added(added(EMPTY_BATCH, onPinos(100), 'k1'), onMonje(40), 'k2');
  const ok: WorkProgressResult = { ok: true, message: 'Calle guardada.' };

  it('saves in order, says the progress and empties the list', async () => {
    const calls: string[] = [];
    const steps: string[] = [];
    const saved = await saveStreetBatch(two(), async (_draft, entryId) => { calls.push(entryId); return ok; }, (index, total) => steps.push(batchSaveLabel(index, total)));
    expect(calls).toEqual(['k1', 'k2']);
    expect(steps).toEqual(['Guardando 1 de 2…', 'Guardando 2 de 2…']);
    expect(saved).toEqual({ ok: true, batch: EMPTY_BATCH, savedCount: 2, message: '2 calles guardadas. Ya aparecen en el mapa.' });
  });

  it('stops at the first failure, keeps what was not saved with Portal\'s message, and resumes with the same ids', async () => {
    const failing = async (_draft: StreetDraft, entryId: string): Promise<WorkProgressResult> => (entryId === 'k2' ? { ok: false, message: 'La obra está cerrada.' } : ok);
    const first = await saveStreetBatch(two(), failing, () => undefined);
    expect(first.ok).toBe(false);
    expect(first.savedCount).toBe(1);
    expect(first.batch.streets.map((street) => street.key)).toEqual(['k2']);
    expect(first.batch.streets[0]?.error).toBe('La obra está cerrada.');
    expect(first.message).toBe('Se guardó 1 de 2. Jr. Monje: La obra está cerrada.');
    const calls: string[] = [];
    const again = await saveStreetBatch(first.batch, async (_draft, entryId) => { calls.push(entryId); return ok; }, () => undefined);
    expect(calls).toEqual(['k2']);
    expect(again.message).toBe('1 calle guardada. Ya aparece en el mapa.');
  });

  it('a thrown send is a failure with a plain message, never an unhandled error', async () => {
    const thrown = await saveStreetBatch(two(), async () => { throw new Error('socket closed'); }, () => undefined);
    expect(thrown).toMatchObject({ ok: false, savedCount: 0 });
    expect(thrown.batch.streets[0]?.error).toBe('No se pudo guardar la calle. Revisa tu señal y vuelve a guardar.');
  });

  it('the stage of a hand street rides on its draft', async () => {
    const drafts: StreetDraft[] = [];
    const batch = addHandStreet(EMPTY_BATCH, { ...EMPTY_STREET, mode: 'hand', name: 'Pasaje', points: [east(0), east(50)], widthM: null, stageId: 'e1' }, 'h1');
    await saveStreetBatch(batch, async (draft) => { drafts.push(draft); return ok; }, () => undefined);
    expect(drafts[0]).toMatchObject({ name: 'Pasaje', stageId: 'e1' });
  });
});

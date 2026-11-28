import { describe, expect, it } from 'vitest';
import { EMPTY_STREET } from './workStreetDraft.js';
import type { WorkProgressResult } from './workProgressSend.js';
import { BATCH_EMPTY, BATCH_NO_STREET } from './workStreetBatch.js';
import { batchScreenActions, batchScreenAddHand, batchScreenAnswer, batchScreenCancel, batchScreenEdit, batchScreenTap, EMPTY_BATCH_SCREEN, finishStreetBatch, type BatchScreen } from './workStreetBatchScreen.js';

const M_PER_DEG_LNG = 111_195 * Math.cos((12 * Math.PI) / 180);
const east = (meters: number) => ({ lat: -12, lng: -77 + meters / M_PER_DEG_LNG });
const pinos = { properties: { class: 'minor', name: 'Jr. Los Pinos' }, geometry: { type: 'LineString', coordinates: [[east(0).lng, -12], [east(500).lng, -12]] } };
const onPinos = { underFinger: [pinos], nearby: [pinos], tap: east(100) };
const ok: WorkProgressResult = { ok: true, message: 'Calle guardada.' };

describe('the ma02 screen', () => {
  it('a tap adds; a tap with no road leaves the list and says why', () => {
    const one = batchScreenTap(EMPTY_BATCH_SCREEN, onPinos, [], 'k1');
    expect(one.batch.streets).toHaveLength(1);
    const missed = batchScreenTap(one, { underFinger: [], nearby: [], tap: east(0) }, [], 'k2');
    expect(missed).toMatchObject({ problem: BATCH_NO_STREET });
    expect(missed.batch).toBe(one.batch);
  });

  it('an edited street asks «Quitar» on the band; yes removes it, no keeps it', () => {
    const edited = batchScreenEdit(batchScreenTap(EMPTY_BATCH_SCREEN, onPinos, [], 'k1'), 'k1', { widthM: 6 });
    const asked = batchScreenTap(edited, onPinos, [], 'k2');
    expect(asked.question).toMatchObject({ yes: 'Quitar', then: { kind: 'remove', key: 'k1' } });
    expect(batchScreenAnswer(asked, false)).toEqual({ screen: { ...asked, question: null }, leave: false });
    expect(batchScreenAnswer(asked, true).screen.batch.streets).toEqual([]);
  });

  it('«Cancelar» leaves an empty list at once and asks before losing streets', () => {
    expect(batchScreenCancel(EMPTY_BATCH_SCREEN).leave).toBe(true);
    const hand = batchScreenAddHand(EMPTY_BATCH_SCREEN, { ...EMPTY_STREET, mode: 'hand', name: 'Pasaje', points: [east(0), east(50)] }, 'h1');
    const asked = batchScreenCancel(hand);
    expect(asked).toMatchObject({ leave: false, screen: { question: { text: '¿Salir sin guardar 1 calle?', yes: 'Salir' } } });
    expect(batchScreenAnswer(asked.screen, true).leave).toBe(true);
    expect(batchScreenAnswer(EMPTY_BATCH_SCREEN, true).leave).toBe(false);
  });

  it('«Listo» on an empty list shows the problem and sends nothing', async () => {
    const shown: BatchScreen[] = [];
    const sent = await finishStreetBatch(EMPTY_BATCH_SCREEN, async () => ok, (next) => shown.push(next));
    expect(sent).toBeNull();
    expect(shown[0]?.problem).toBe(BATCH_EMPTY);
  });

  it('«Listo» shows each step, then the emptied list', async () => {
    const shown: BatchScreen[] = [];
    const one = batchScreenTap(EMPTY_BATCH_SCREEN, onPinos, [], 'k1');
    const sent = await finishStreetBatch(one, async () => ok, (next) => shown.push(next));
    expect(sent?.ok).toBe(true);
    expect(shown.map((screen) => screen.progress)).toEqual(['Guardando 1 de 1…', null]);
    expect(shown.at(-1)?.batch.streets).toEqual([]);
  });

  it('a failure keeps the street with Portal\'s message under the map; taps wait while saving', async () => {
    const shown: BatchScreen[] = [];
    const one = batchScreenTap(EMPTY_BATCH_SCREEN, onPinos, [], 'k1');
    const sent = await finishStreetBatch(one, async () => ({ ok: false, message: 'Sin permiso.' }), (next) => shown.push(next));
    expect(sent?.ok).toBe(false);
    expect(shown.at(-1)?.problem).toBe('Jr. Los Pinos: Sin permiso.');
    const saving = { ...one, progress: 'Guardando 1 de 1…' };
    expect(batchScreenTap(saving, onPinos, [], 'k9')).toBe(saving);
    expect(await finishStreetBatch(saving, async () => ok, () => undefined)).toBeNull();
  });
});

describe('the screen handlers', () => {
  const harness = (send: (entryId: string) => Promise<WorkProgressResult>) => {
    let screen = EMPTY_BATCH_SCREEN;
    const calls: string[] = [];
    let keys = 0;
    const set = (update: BatchScreen | ((before: BatchScreen) => BatchScreen)) => { screen = typeof update === 'function' ? update(screen) : update; };
    const deps = { saved: [], newKey: () => `k${++keys}`, send: (_draft: unknown, entryId: string) => send(entryId), onClose: () => calls.push('close'), onSaved: (message: string) => calls.push(message), onPartial: () => calls.push('partial') };
    return { act: () => batchScreenActions(screen, set, deps), screen: () => screen, calls };
  };

  it('tap, rename, «Listo»: saved once, the board hears it', async () => {
    const run = harness(async () => ok);
    run.act().tap(onPinos);
    run.act().edit('k1', { name: 'Cuadra 1' });
    expect(run.screen().batch.streets[0]?.name).toBe('Cuadra 1');
    await run.act().finish();
    expect(run.calls).toEqual(['1 calle guardada. Ya aparece en el mapa.']);
  });

  it('the second of two fails: the map reloads the first, the second stays', async () => {
    const run = harness(async (entryId) => (entryId === 'k2' ? { ok: false, message: 'No.' } : ok));
    run.act().tap(onPinos);
    await run.act().addHand({ ...EMPTY_STREET, mode: 'hand', name: 'Pasaje', points: [east(0), east(50)] });
    await run.act().finish();
    expect(run.calls).toEqual(['partial']);
    expect(run.screen().batch.streets.map((street) => street.key)).toEqual(['k2']);
  });

  it('«Cancelar» with streets asks; «Salir» closes; «Quitar» from the list needs no question', () => {
    const run = harness(async () => ok);
    run.act().cancel();
    expect(run.calls).toEqual(['close']);
    run.act().tap(onPinos);
    run.act().cancel();
    expect(run.screen().question?.yes).toBe('Salir');
    run.act().answer(true);
    expect(run.calls).toEqual(['close', 'close']);
    run.act().remove('k1');
    expect(run.screen().batch.streets).toEqual([]);
  });
});

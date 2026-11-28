import { describe, expect, it, vi } from 'vitest';
import type { WorkMap } from './workMap.js';
import type { MapEditSend } from './workScopeDraft.js';
import { MANUAL_NO_LENGTH, MANUAL_SENT } from './workManualProgress.js';
import {
  AVANCE_PERCENTS,
  avanceAlready,
  avanceChipsOf,
  avanceEndFor,
  avanceHint,
  avanceKicker,
  avancePickedWork,
  avanceProblem,
  avanceProgressLine,
  avanceRequests,
  avanceStartsLater,
  avanceTargetOf,
  runAvanceSave,
} from './workAvanceMode.js';

/** «Modo Avance» (design av-01, José 27/11): pick a work, tap a street, a big button, save. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }];
const MAP: WorkMap = {
  streets: [
    { id: 's1', name: 'Jr. Lima', line, lengthM: 120 },
    { id: 's2', name: 'Jr. Grau', line, lengthM: 80 },
    { id: 's3', name: 'Jr. Comercio', line, lengthM: 200 },
  ],
  scopes: [
    { id: 'c1', streetId: 's1', fromM: 0, toM: 120, workIds: ['imp'] },
    { id: 'c2', streetId: 's2', fromM: 0, toM: 80, workIds: ['base'], stageId: 'e1' },
  ],
  progress: [
    { streetId: 's1', workId: 'imp', fromM: 0, toM: 60, date: '2026-11-20', rework: false },
  ],
  works: [{ id: 'imp', name: 'Imprimación', color: '#2563eb' }, { id: 'base', name: 'Base', color: '#d97706' }, { id: 'asf', name: 'Asfalto', color: '#111827', partida: true }],
  stages: [{ id: 'e1', name: 'Etapa 1' }],
};
const NOW = new Date('2026-11-27T15:00:00Z');
const IDS = { scope: 'scope-entry', progress: 'progress-entry' };

describe('avanceChipsOf', () => {
  it('lists every work with its percent and marks the picked one', () => {
    // Act
    const chips = avanceChipsOf(MAP, 'imp');
    // Assert
    expect(chips.map((chip) => [chip.id, chip.label, chip.selected])).toEqual([['imp', 'Imprimación 50 %', true], ['base', 'Base 0 %', false], ['asf', 'Asfalto 0 %', false]]);
    expect(chips[0]?.color).toBe('#2563eb');
  });

  it('is empty without works', () => {
    expect(avanceChipsOf({ ...MAP, works: [] }, null)).toEqual([]);
  });
});

describe('avancePickedWork', () => {
  it('keeps the picked work while it exists, else the first one, else none', () => {
    expect(avancePickedWork(MAP, 'base')).toBe('base');
    expect(avancePickedWork(MAP, 'gone')).toBe('imp');
    expect(avancePickedWork(MAP, null)).toBe('imp');
    expect(avancePickedWork({ ...MAP, works: [] }, 'imp')).toBeNull();
  });
});

describe('avanceTargetOf', () => {
  it('reads what is done on a street that carries the work', () => {
    expect(avanceTargetOf(MAP, 's1', 'imp')).toEqual({ streetId: 's1', streetName: 'Jr. Lima', workId: 'imp', workName: 'Imprimación', lengthM: 120, doneM: 60, fromM: 60, needsScope: false });
  });

  it('a street without the work needs a stretch first and starts where its stretches start', () => {
    expect(avanceTargetOf(MAP, 's2', 'imp')).toMatchObject({ doneM: 0, fromM: 0, needsScope: true });
    expect(avanceTargetOf(MAP, 's3', 'imp')).toMatchObject({ lengthM: 200, fromM: 0, needsScope: true });
  });

  it('a stretch that starts later starts the progress there', () => {
    const later: WorkMap = { ...MAP, scopes: [{ id: 'c9', streetId: 's3', fromM: 40, toM: 200, workIds: ['base'] }] };
    expect(avanceTargetOf(later, 's3', 'imp')).toMatchObject({ fromM: 40, needsScope: true });
  });

  it('rework does not count as done', () => {
    const redone: WorkMap = { ...MAP, progress: [{ streetId: 's1', workId: 'imp', fromM: 0, toM: 90, date: '2026-11-21', rework: true }] };
    expect(avanceTargetOf(redone, 's1', 'imp')).toMatchObject({ doneM: 0, fromM: 0 });
  });

  it('is null for an unknown street or work', () => {
    expect(avanceTargetOf(MAP, 'nope', 'imp')).toBeNull();
    expect(avanceTargetOf(MAP, 's1', 'nope')).toBeNull();
  });
});

describe('avanceEndFor and the labels', () => {
  it('turns a percent into the end chainage, rounded', () => {
    const target = avanceTargetOf(MAP, 's1', 'imp')!;
    expect(AVANCE_PERCENTS).toEqual([0, 25, 50, 75, 100]);
    expect(avanceEndFor(target, 75)).toBe(90);
    expect(avanceEndFor({ ...target, lengthM: 101 }, 25)).toBe(25);
    expect(avanceEndFor(target, 100)).toBe(120);
  });

  it('says what to tap, the head of the panel and the done metres', () => {
    const target = avanceTargetOf(MAP, 's1', 'imp')!;
    expect(avanceHint('Imprimación')).toBe('Toca una calle para marcar su avance de Imprimación');
    expect(avanceKicker(target)).toBe('IMPRIMACIÓN · JR. LIMA');
    expect(avanceProgressLine(target)).toEqual({ line: '60 m de 120 m', percent: 50 });
    expect(avanceProgressLine({ ...target, lengthM: 0 })).toEqual({ line: '60 m de 0 m', percent: 0 });
  });
});

describe('avanceProblem', () => {
  const target = avanceTargetOf(MAP, 's1', 'imp')!;

  it('refuses an end at or below what is already done', () => {
    expect(avanceProblem(target, 60)).toBe(avanceAlready(60, 'Imprimación'));
    expect(avanceProblem(target, 30)).toBe('Esta calle ya va en 60 m de Imprimación.');
  });

  it('refuses no length on a street with nothing done, and an end before the stretch starts', () => {
    const fresh = avanceTargetOf(MAP, 's3', 'imp')!;
    expect(avanceProblem(fresh, 0)).toBe(MANUAL_NO_LENGTH);
    expect(avanceProblem({ ...fresh, fromM: 40 }, 30)).toBe(avanceStartsLater(40));
  });

  it('refuses an end past the street and lets a good one through', () => {
    expect(avanceProblem(target, 150)).toMatch(/pasa el largo de la calle \(120 m\)/);
    expect(avanceProblem(target, 90)).toBeNull();
    expect(avanceProblem(target, null)).toBe(MANUAL_NO_LENGTH);
  });
});

describe('avanceRequests', () => {
  it('only the manual progress when the street carries the work', () => {
    const requests = avanceRequests(MAP, avanceTargetOf(MAP, 's1', 'imp')!, 90, IDS, NOW);
    expect(requests).toEqual([{ kind: 'work_manual_progress', street_id: 's1', tag_id: 'imp', from_m: 60, to_m: 90, entry_id: 'progress-entry', device_at: NOW.toISOString(), photo_ids: [], forms: expect.any(Number) }]);
  });

  it('a street with no stretch gets one for the whole street first', () => {
    const [scope, progress] = avanceRequests(MAP, avanceTargetOf(MAP, 's3', 'imp')!, 100, IDS, NOW);
    expect(scope).toMatchObject({ kind: 'work_scope', street_id: 's3', from_m: 0, to_m: 200, tag_ids: ['imp'], entry_id: 'scope-entry' });
    expect(progress).toMatchObject({ kind: 'work_manual_progress', street_id: 's3', from_m: 0, to_m: 100 });
  });

  it('a street with stretches of other works gets the work added to them; a partida goes as partida', () => {
    const [scope, progress] = avanceRequests(MAP, avanceTargetOf(MAP, 's2', 'asf')!, 40, IDS, NOW);
    expect(scope).toMatchObject({ kind: 'work_scope', scope_id: 'c2', tag_ids: ['base'], partida_ids: ['asf'], stage_id: 'e1' });
    expect(progress).toMatchObject({ partida_id: 'asf', from_m: 0, to_m: 40 });
  });
});

describe('runAvanceSave', () => {
  const ok: MapEditSend = async (request) => ({ ok: true, message: request.kind === 'work_manual_progress' ? MANUAL_SENT : 'Tramo guardado.' });

  it('sends the stretch, then the progress, and answers that it waits for approval', async () => {
    // Arrange
    const send = vi.fn(ok);
    // Act
    const answer = await runAvanceSave({ map: MAP, target: avanceTargetOf(MAP, 's3', 'imp')!, toM: 100, ids: IDS, now: NOW, send });
    // Assert
    expect(send.mock.calls.map(([request]) => request.kind)).toEqual(['work_scope', 'work_manual_progress']);
    expect(answer).toEqual({ ok: true, message: MANUAL_SENT });
  });

  it('sends nothing when the end is wrong', async () => {
    const send = vi.fn(ok);
    const answer = await runAvanceSave({ map: MAP, target: avanceTargetOf(MAP, 's1', 'imp')!, toM: 50, ids: IDS, now: NOW, send });
    expect(send).not.toHaveBeenCalled();
    expect(answer).toEqual({ ok: false, message: 'Esta calle ya va en 60 m de Imprimación.' });
  });

  it('stops at the first refusal and says it', async () => {
    const send = vi.fn<MapEditSend>(async () => ({ ok: false, message: 'Sin señal.' }));
    const answer = await runAvanceSave({ map: MAP, target: avanceTargetOf(MAP, 's3', 'imp')!, toM: 100, ids: IDS, now: NOW, send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(answer).toEqual({ ok: false, message: 'Sin señal.' });
  });
});

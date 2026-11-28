import { describe, expect, it, vi } from 'vitest';
import type { WorkMap } from './workMap.js';
import type { MapEditSend } from './workScopeDraft.js';
import {
  byApproveActions,
  byApproveOf,
  loadByApprove,
  pendingAlready,
  pendingEndOf,
  undoableIds,
  undoableOf,
  undoByApprove,
  undoQuestion,
  undoRequestOf,
  withPendingOf,
  workByApproveRequest,
  workUndoRequest,
  UNDONE,
} from './workByApprove.js';

/** José 28/11: field progress counts once recorded; its author, or an admin, can undo it. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }];
const MAP: WorkMap = {
  streets: [{ id: 's1', name: 'Jr. Lima', line, lengthM: 120 }, { id: 's2', name: 'Jr. Grau', line, lengthM: 80 }],
  scopes: [{ id: 'c1', streetId: 's1', fromM: 0, toM: 120, workIds: ['imp', 'asf'] }],
  progress: [{ streetId: 's1', workId: 'imp', fromM: 0, toM: 30, date: '2026-11-20', rework: false }],
  works: [{ id: 'imp', name: 'Imprimación', color: '#2563eb' }, { id: 'asf', name: 'Asfalto', color: '#111827', partida: true }],
  stages: [],
};
const DATA = {
  total: 5,
  avances: [
    { avanceId: 'a3', estado: 'pendiente', fecha: '2026-11-28', calleId: 's1', desdeM: 30, hastaM: 60, tagId: 'imp', metrado: 30, autor: 'Ana Ruiz', propio: true },
    { avanceId: 'a2', estado: 'pendiente', fecha: '2026-11-27', calleId: 's1', desdeM: 0, hastaM: 40, partidaId: 'asf', metrado: 40, autor: 'Luis', propio: false },
    { avanceId: 'a1', estado: 'pendiente', fecha: '2026-11-26', calleId: 's1', desdeM: 30, hastaM: 45, tagId: 'imp', metrado: 15, autor: 'Ana Ruiz', propio: true },
    { avanceId: 'r1', estado: 'rechazado', fecha: '2026-11-25', calleId: 's1', desdeM: 30, hastaM: 120, tagId: 'imp', metrado: 90, autor: 'Ana Ruiz', propio: true, notaRechazo: ' mal medido ' },
    { avanceId: 'x1', estado: 'borrado', calleId: 's1', desdeM: 0, hastaM: 10 },
    { avanceId: '', estado: 'pendiente' },
    'x',
  ],
};

describe('byApproveOf', () => {
  it('reads every pending and rejected one, and skips an unknown state or a row without id', () => {
    // Act
    const list = byApproveOf(DATA);
    // Assert
    expect(list.total).toBe(5);
    expect(list.items.map((one) => [one.id, one.state])).toEqual([['a3', 'pendiente'], ['a2', 'pendiente'], ['a1', 'pendiente'], ['r1', 'rechazado']]);
    expect(list.items[0]).toMatchObject({ streetId: 's1', fromM: 30, toM: 60, workId: 'imp', quantity: 30, author: 'Ana Ruiz', own: true, rejectNote: null });
    expect(list.items[1]).toMatchObject({ workId: 'asf', own: false });
    expect(list.items[3]?.rejectNote).toBe('mal medido');
  });

  it('reads how many photos a record has, as a count or as its ids (José 28/11: «Agregar foto»)', () => {
    // Arrange
    const raw = { avances: [{ avanceId: 'a1', estado: 'pendiente', fotos: 2 }, { avanceId: 'a2', estado: 'pendiente', fotoIds: ['m1', 'm2', 'm3'] }, { avanceId: 'a3', estado: 'pendiente', fotos: 'x' }] };
    // Act
    const items = byApproveOf(raw).items;
    // Assert
    expect(items.map((one) => one.photos)).toEqual([2, 3, 0]);
  });

  it('reads it wrapped as the door hands it over, and tolerates nothing or wrong fields', () => {
    // Arrange
    const wrong = { avances: [{ avanceId: 'a9', estado: 'pendiente', calleId: 7, desdeM: -3, hastaM: 'x', propio: 'si' }] };
    // Act
    const wrapped = byApproveOf({ data: DATA });
    const broken = byApproveOf(wrong);
    // Assert
    expect(wrapped.items).toHaveLength(4);
    expect(byApproveOf(undefined)).toEqual({ total: 0, items: [] });
    expect(broken.items[0]).toMatchObject({ id: 'a9', streetId: null, fromM: null, toM: null, workId: null, own: false, author: null });
    expect(broken.total).toBe(1);
  });
});

describe('field progress counts as soon as it is recorded (José 28/11: no approval)', () => {
  it('adds every pending one with a whole stretch to the done progress, with its id; rejected never count', () => {
    // Act
    const map = withPendingOf(MAP, byApproveOf(DATA));
    // Assert
    expect(map.progress).toEqual([
      MAP.progress[0],
      { id: 'a3', streetId: 's1', workId: 'imp', fromM: 30, toM: 60, date: '2026-11-28', rework: false },
      { id: 'a2', streetId: 's1', workId: 'asf', fromM: 0, toM: 40, date: '2026-11-27', rework: false },
      { id: 'a1', streetId: 's1', workId: 'imp', fromM: 30, toM: 45, date: '2026-11-26', rework: false },
    ]);
    expect(map.pending).toBeUndefined();
    expect(withPendingOf(MAP, null)).toBe(MAP);
  });

  it('does not add one twice when Portal already lists it as done', () => {
    // Arrange
    const approved: WorkMap = { ...MAP, progress: [...MAP.progress, { id: 'a3', streetId: 's1', workId: 'imp', fromM: 30, toM: 60, date: '2026-11-28', rework: false }] };
    // Act
    const map = withPendingOf(approved, byApproveOf(DATA));
    // Assert
    expect(map.progress.filter((one) => one.id === 'a3')).toHaveLength(1);
  });

  it('says where the pending progress of a work on a street ends, when a map still carries one', () => {
    // Arrange
    const map: WorkMap = { ...MAP, pending: [{ streetId: 's1', workId: 'imp', fromM: 30, toM: 60 }] };
    // Act / Assert
    expect(pendingEndOf(map, 's1', 'imp')).toBe(60);
    expect(pendingEndOf(map, 's2', 'imp')).toBeNull();
    expect(pendingEndOf(withPendingOf(MAP, byApproveOf(DATA)), 's1', 'imp')).toBeNull();
  });
});

describe('undo', () => {
  it('offers the caller\'s newest pending one of a street and work, never someone else\'s nor a rejected one', () => {
    // Arrange
    const list = byApproveOf(DATA);
    // Act / Assert
    expect(undoableOf(list, 's1', 'imp')?.id).toBe('a3');
    expect(undoableOf(list, 's1', 'asf')).toBeNull();
    expect(undoableOf(null, 's1', 'imp')).toBeNull();
    expect([...undoableIds(list)]).toEqual(['a3']);
  });

  it('asks and refuses in words', () => {
    expect(undoQuestion(60)).toBe('¿Deshacer el avance hasta 0+060? Deja de sumar al avance de la obra.');
    expect(pendingAlready(60)).toBe('Ya hay un avance registrado hasta 0+060 en esta calle.');
  });

  it('builds the requests the door opens', () => {
    expect(workByApproveRequest()).toMatchObject({ kind: 'work_by_approve' });
    expect(workUndoRequest('a3')).toMatchObject({ kind: 'work_undo', progress_id: 'a3' });
  });

  it('deletes the caller\'s own pending one, and an admin takes back anything else with the existing reject', () => {
    // Arrange
    const list = byApproveOf(DATA);
    // Act / Assert
    expect(undoRequestOf(list, 'a3')).toMatchObject({ kind: 'work_undo', progress_id: 'a3' });
    expect(undoRequestOf(list, 'a2')).toMatchObject({ kind: 'work_resolve', progress_id: 'a2', decision: 'rechazar' });
    expect(undoRequestOf(list, 'done-1')).toMatchObject({ kind: 'work_resolve', progress_id: 'done-1', decision: 'rechazar' });
    expect(undoRequestOf(null, 'a3')).toMatchObject({ kind: 'work_resolve', decision: 'rechazar' });
  });

  it('answers null when undone, Portal\'s reason when not', async () => {
    // Arrange
    const ok = vi.fn<MapEditSend>(async () => ({ ok: true, message: UNDONE }));
    const refused = vi.fn<MapEditSend>(async () => ({ ok: false, message: 'No es tuyo.' }));
    const list = byApproveOf(DATA);
    // Act / Assert
    expect(await undoByApprove(ok, 'a3', list)).toBeNull();
    expect(ok.mock.calls[0]![0]).toMatchObject({ kind: 'work_undo', progress_id: 'a3' });
    expect(await undoByApprove(ok, 'a2', list)).toBeNull();
    expect(ok.mock.calls[1]![0]).toMatchObject({ kind: 'work_resolve', progress_id: 'a2', decision: 'rechazar' });
    expect(await undoByApprove(refused, 'a3', list)).toBe('No es tuyo.');
  });
});

describe('loadByApprove', () => {
  it('reads the list, and is null when the door refuses, throws or the tool is missing', async () => {
    // Arrange
    const ok = vi.fn<MapEditSend>(async () => ({ ok: true, message: '', data: DATA }));
    const missing = vi.fn<MapEditSend>(async () => ({ ok: false, message: 'No encontrado.' }));
    const threw = vi.fn<MapEditSend>(async () => { throw new Error('offline'); });
    // Act / Assert
    expect((await loadByApprove(ok))?.items).toHaveLength(4);
    expect(ok.mock.calls[0]![0]).toMatchObject({ kind: 'work_by_approve' });
    expect(await loadByApprove(missing)).toBeNull();
    expect(await loadByApprove(threw)).toBeNull();
  });
});

describe('byApproveActions', () => {
  it('loads into the list, undoes and loads again; without a door the list is empty', async () => {
    // Arrange
    const send = vi.fn<MapEditSend>(async (request) => (request.kind === 'work_by_approve' ? { ok: true, message: '', data: DATA } : { ok: true, message: UNDONE }));
    const setList = vi.fn();
    const actions = byApproveActions({ current: send }, setList);
    // Act
    actions.load();
    const failure = await actions.undo('a3');
    // Assert
    expect(failure).toBeNull();
    await vi.waitFor(() => expect(setList).toHaveBeenCalledTimes(2));
    expect(send.mock.calls.map(([request]) => request.kind)).toEqual(['work_by_approve', 'work_undo', 'work_by_approve']);
  });

  it('answers the failure when there is no door, and does not reload after a refusal', async () => {
    // Arrange
    const setList = vi.fn();
    const refused = vi.fn<MapEditSend>(async () => ({ ok: false, message: 'No es tuyo.' }));
    // Act
    byApproveActions({ current: undefined }, setList).load();
    const none = await byApproveActions({ current: undefined }, setList).undo('a3');
    const no = await byApproveActions({ current: refused }, setList).undo('a3');
    // Assert
    expect(setList).toHaveBeenCalledWith(null);
    expect(none).toMatch(/No se pudo deshacer/);
    expect(no).toBe('No es tuyo.');
    expect(refused).toHaveBeenCalledTimes(1);
  });
});

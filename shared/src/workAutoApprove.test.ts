import { describe, expect, it, vi } from 'vitest';
import { approvingMapSend, approvingProgressSend, createdProgressIdOf } from './workAutoApprove.js';
import type { WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/** José 28/11: «ningún admin lo aprueba». An admin's record approves itself with the existing tool. */
const created: WorkProgressResult = { ok: true, message: 'Avance registrado.', data: { avanceId: 'a1', fecha: '2026-11-28', metrado: 30, estado: 'pendiente' } };
const manual = { kind: 'work_manual_progress', street_id: 's1', tag_id: 't1', from_m: 0, to_m: 30, entry_id: 'e1', device_at: '2026-11-28T10:00:00.000Z', photo_ids: [], forms: 1 } as const;

const doorAnswering = (first: WorkProgressResult, resolved: WorkProgressResult = { ok: true, message: 'Listo.' }) =>
  vi.fn<MapEditSend>(async (request) => (request.kind === 'work_resolve' ? resolved : first));

describe('createdProgressIdOf', () => {
  it('reads the new record, as is or wrapped once more by the door', () => {
    expect(createdProgressIdOf(created)).toBe('a1');
    expect(createdProgressIdOf({ ok: true, message: '', data: { data: { avanceId: 'a2', estado: 'pendiente' } } })).toBe('a2');
  });

  it('is null for a refusal, a record that already existed, or an answer without id', () => {
    expect(createdProgressIdOf({ ok: false, message: 'No.' })).toBeNull();
    expect(createdProgressIdOf({ ok: true, message: '', data: { code: 'ya_marcada', avanceId: 'a1' } })).toBeNull();
    expect(createdProgressIdOf({ ok: true, message: '' })).toBeNull();
    expect(createdProgressIdOf({ ok: true, message: '', data: { avanceId: 7, estado: 'pendiente' } })).toBeNull();
  });
});

describe('approvingMapSend', () => {
  it('approves the record an admin just made, and answers what the record answered', async () => {
    // Arrange
    const door = doorAnswering(created);
    // Act
    const answer = await approvingMapSend(door)(manual, async () => created);
    // Assert
    expect(answer).toEqual(created);
    expect(door.mock.calls.map(([request]) => request)).toEqual([manual, expect.objectContaining({ kind: 'work_resolve', progress_id: 'a1', decision: 'aprobar' })]);
  });

  it('keeps the record when the approval is refused or throws', async () => {
    // Arrange
    const refused = doorAnswering(created, { ok: false, message: 'Sin permiso.' });
    const threw = vi.fn<MapEditSend>(async (request) => { if (request.kind === 'work_resolve') throw new Error('offline'); return created; });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Act / Assert
    expect(await approvingMapSend(refused)(manual, async () => created)).toEqual(created);
    expect(await approvingMapSend(threw)(manual, async () => created)).toEqual(created);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('never approves other edits, a failed record, or one that already existed', async () => {
    // Arrange
    const door = doorAnswering({ ok: true, message: 'Tramo guardado.', data: { avanceId: 'x', estado: 'pendiente' } });
    const failed = doorAnswering({ ok: false, message: 'No.' });
    const again = doorAnswering({ ok: true, message: '', data: { code: 'ya_marcada', avanceId: 'a1' } });
    // Act
    await approvingMapSend(door)({ kind: 'work_stage', name: 'Etapa 1', forms: 1 } as never, async () => created);
    await approvingMapSend(failed)(manual, async () => created);
    await approvingMapSend(again)(manual, async () => created);
    // Assert
    for (const one of [door, failed, again]) expect(one).toHaveBeenCalledTimes(1);
  });
});

describe('approvingProgressSend', () => {
  it('approves the unit-suggested record with the map door', async () => {
    // Arrange
    const door = doorAnswering(created);
    const progress = vi.fn(async (_entry: { id: string }) => created);
    // Act
    const answer = await approvingProgressSend(progress, door)({ id: 'e1' });
    // Assert
    expect(answer).toEqual(created);
    expect(progress).toHaveBeenCalledWith({ id: 'e1' });
    expect(door.mock.calls[0]![0]).toMatchObject({ kind: 'work_resolve', progress_id: 'a1', decision: 'aprobar' });
  });
});

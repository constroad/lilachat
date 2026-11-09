import { describe, expect, it } from 'vitest';
import { loadPendingProgress, pendingDetail, pendingProgressOf, pendingTitle, resolvePendingProgress, workPendingRequest, workResolveRequest } from './workPending.js';

/**
 * José 09/11: «Registrar avance» left nothing to see: Portal kept it pending and the map reads only
 * what was approved. Portal a9b1c3ba: `avances_pendientes_de_obra` lists them and
 * `resolver_avance_de_obra` approves or rejects one (admins).
 */
const data = {
  total: 2,
  verTodos: true,
  pendientes: [
    { avanceId: 'a1', fecha: '2026-11-09', calleId: 's1', calle: 'Jr. Moquegua', desdeM: 0, hastaM: 30, metrado: 180, trabajo: 'Asfalto QA', unidades: 0, fotos: 2, registradoPor: 'Ana Ruiz' },
    { avanceId: 'a2', fecha: '2026-11-08', calleId: null, calle: 'Calle sin nombre', metrado: 12.5, trabajo: 'Bacheo', unidades: 3, fotos: 0, registradoPor: null, nota: 'lado norte' },
    { avanceId: '', calle: 'x' },
    'x',
  ],
};

describe('pending progress of the work map', () => {
  it('reads Portal\'s list and drops what does not fit', () => {
    // Act
    const pending = pendingProgressOf(data);
    // Assert
    expect(pending.seesAll).toBe(true);
    expect(pending.more).toBe(false);
    expect(pending.items.map((one) => one.id)).toEqual(['a1', 'a2']);
    expect(pending.items[0]).toMatchObject({ streetId: 's1', street: 'Jr. Moquegua', fromM: 0, toM: 30, work: 'Asfalto QA', photos: 2, by: 'Ana Ruiz' });
    expect(pending.items[1]).toMatchObject({ streetId: null, fromM: null, toM: null, units: 3, note: 'lado norte', by: null });
    expect(pendingProgressOf(undefined)).toEqual({ items: [], seesAll: false, more: false });
  });

  it('says how many wait, in words a site engineer reads', () => {
    expect(pendingTitle(0)).toBe('Nada por aprobar');
    expect(pendingTitle(1)).toBe('1 avance por aprobar');
    expect(pendingTitle(3, true)).toBe('Más de 3 avances por aprobar');
  });

  it('one line with the street, the stretch, the work, the day and who', () => {
    const [first, second] = pendingProgressOf(data).items;
    expect(pendingDetail(first!)).toBe('Jr. Moquegua · 0+000 a 0+030 · Asfalto QA · 9 nov · por Ana Ruiz');
    expect(pendingDetail(second!)).toBe('Calle sin nombre · Bacheo · 3 unidades · 8 nov');
  });

  it('asks the list with only the service, and resolves with the progress and the decision', () => {
    expect(workPendingRequest()).toEqual({ kind: 'work_pending', forms: expect.any(Number) });
    expect(workResolveRequest('a1', 'aprobar')).toEqual({ kind: 'work_resolve', progress_id: 'a1', decision: 'aprobar', forms: expect.any(Number) });
    expect(workResolveRequest('a1', 'rechazar', '  medido mal ')).toMatchObject({ note: 'medido mal' });
  });
});

describe('through the door', () => {
  it('loads the list, or says why not; resolving answers null when it worked', async () => {
    const ok = async () => ({ ok: true as const, message: 'x', data });
    const refused = async () => ({ ok: false as const, message: 'Solo admins.' });
    expect(await loadPendingProgress(ok)).toMatchObject({ state: 'ready', pending: { items: [{ id: 'a1' }, { id: 'a2' }] } });
    expect(await loadPendingProgress(refused)).toEqual({ state: 'failed', message: 'Solo admins.' });
    expect(await resolvePendingProgress(ok, 'a1', 'aprobar')).toBeNull();
    expect(await resolvePendingProgress(refused, 'a1', 'rechazar')).toBe('Solo admins.');
  });
});

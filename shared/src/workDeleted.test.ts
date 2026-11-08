import { describe, expect, it } from 'vitest';
import { deletedRowsOf, deletedWorkOf, loadDeletedRows, NOTHING_DELETED, restoreDeleted, sendWorkDeleted, workDeletedRequest, workRestoreRequest } from './workDeleted.js';

/** What was deleted from the map, for admins to restore (José 07/11: «borrado lógico que el admin pueda restaurar»). */
const data = {
  calles: [{ calleId: 's9', nombre: 'Jr. Las Flores', largoM: 280.4, borradoEl: '2026-11-07T15:20:00.000Z', borradoPor: 'Ana Ruiz' }],
  tramos: [{ tramoId: 'c7', calleId: 's1', desdeM: 120, hastaM: 191, borradoEl: '2026-11-07T20:53:00.000Z', borradoPor: null }],
};
const names = new Map([['s1', 'Jr. Los Pinos']]);

describe('what was deleted from the map', () => {
  it('reads Portal\'s list and drops what does not fit', () => {
    const deleted = deletedWorkOf({ ...data, tramos: [...data.tramos, { tramoId: '', calleId: 's1' }, 'x'] });
    expect(deleted).toEqual({
      streets: [{ id: 's9', name: 'Jr. Las Flores', lengthM: 280.4, deletedAt: '2026-11-07T15:20:00.000Z', deletedBy: 'Ana Ruiz' }],
      scopes: [{ id: 'c7', streetId: 's1', fromM: 120, toM: 191, deletedAt: '2026-11-07T20:53:00.000Z', deletedBy: null }],
      stages: [],
      tags: [],
    });
    expect(deletedWorkOf(undefined)).toEqual({ streets: [], scopes: [], stages: [], tags: [] });
  });

  it('a row per street and per stretch, newest first, with who and when in Lima', () => {
    const rows = deletedRowsOf(deletedWorkOf(data), names);
    expect(rows).toEqual([
      { kind: 'scope', id: 'c7', title: 'Tramo 0+120 a 0+191', detail: 'Jr. Los Pinos · 71 m · borrado el 7 nov, 3:53 p. m.' },
      { kind: 'street', id: 's9', title: 'Jr. Las Flores', detail: '280 m · borrada el 7 nov, 10:20 a. m. por Ana Ruiz' },
    ]);
    expect(NOTHING_DELETED).toBe('No hay nada borrado en el mapa.');
  });

  it('lists the stages and works deleted too, and restores each by its own key (Portal c1c35c58)', () => {
    // Arrange
    const more = { etapas: [{ etapaId: 'e1', nombre: 'Etapa 2', borradoEl: '2026-11-08T21:00:00.000Z', borradoPor: 'J zamora' }], etiquetas: [{ etiquetaId: 't1', nombre: 'Bacheo', color: '#0d9488', borradoEl: '2026-11-08T20:00:00.000Z' }] };
    // Act
    const rows = deletedRowsOf(deletedWorkOf(more), names);
    // Assert
    expect(rows).toEqual([
      { kind: 'stage', id: 'e1', title: 'Etapa «Etapa 2»', detail: 'borrada el 8 nov, 4:00 p. m. por J zamora' },
      { kind: 'tag', id: 't1', title: 'Trabajo «Bacheo»', detail: 'borrado el 8 nov, 3:00 p. m.' },
    ]);
    expect(workRestoreRequest({ kind: 'stage', id: 'e1' })).toEqual({ kind: 'work_restore', stage_id: 'e1', forms: expect.any(Number) });
    expect(workRestoreRequest({ kind: 'tag', id: 't1' })).toEqual({ kind: 'work_restore', tag_id: 't1', forms: expect.any(Number) });
  });

  it('restores a street or a stretch, and asks the list with only the service', () => {
    expect(workRestoreRequest({ kind: 'street', id: 's9' })).toEqual({ kind: 'work_restore', street_id: 's9', forms: expect.any(Number) });
    expect(workRestoreRequest({ kind: 'scope', id: 'c7' })).toEqual({ kind: 'work_restore', scope_id: 'c7', forms: expect.any(Number) });
    expect(workDeletedRequest()).toEqual({ kind: 'work_deleted', forms: expect.any(Number) });
  });

  it('the list comes in the answer\'s data', async () => {
    const deps = {
      open: async () => ({ ok: true as const, data: { commandId: 'c1', appId: 'a', appName: 'Portal', outcome: 'form' as const, response: { responseType: 'form' as const } } }),
      submit: async () => ({ ok: true as const, outcome: { commandId: 'c1', appId: 'a', appName: 'Portal', outcome: 'ephemeral' as const, response: { responseType: 'ephemeral' as const, text: 'Borrados', data } } }),
      notice: async () => null,
    };
    const result = await sendWorkDeleted(deps as never);
    expect(result).toMatchObject({ ok: true, data });
  });
});

describe('the admin\'s list, through the door', () => {
  it('loads the rows, or says why not; restoring answers null when it worked', async () => {
    const ok = async () => ({ ok: true as const, message: 'x', data });
    const refused = async () => ({ ok: false as const, message: 'Solo admins.' });
    expect(await loadDeletedRows(ok, names)).toMatchObject({ state: 'ready', rows: [{ id: 'c7' }, { id: 's9' }] });
    expect(await loadDeletedRows(refused, names)).toEqual({ state: 'failed', message: 'Solo admins.' });
    expect(await restoreDeleted(ok, { kind: 'street', id: 's9' })).toBeNull();
    expect(await restoreDeleted(refused, { kind: 'scope', id: 'c7' })).toBe('Solo admins.');
  });
});

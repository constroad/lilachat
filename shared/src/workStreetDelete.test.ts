import { describe, expect, it, vi } from 'vitest';
import { FORMS_LEVEL } from './appForms.js';
import { deleteThenReload, runStreetDelete, STREET_DELETE_IDLE, sendWorkStreetDelete, STREET_DELETE_FAILED, STREET_DELETED, streetDeleteAsk, workStreetDeleteRequest } from './workStreetDelete.js';
import type { WorkProgressDeps } from './workProgressSend.js';

/** José 07/11: «que pueda borrar calles cualquiera, pero que sea un borrado lógico que el admin pueda restaurar». */
describe('deleting a street from the map', () => {
  it('asks the server door for Portal\'s delete with only the street', () => {
    expect(workStreetDeleteRequest('6aed0a1b2c3d4e5f60718293')).toEqual({ kind: 'work_street_delete', street_id: '6aed0a1b2c3d4e5f60718293', forms: FORMS_LEVEL });
  });

  it('says what goes with the street and that an admin brings it back', () => {
    expect(streetDeleteAsk('Av. Grau')).toEqual({ title: '¿Borrar «Av. Grau»?', hint: 'Sus tramos se borran con ella. Un admin puede restaurarla. Una calle con avance no se borra.' });
  });

  it('confirms with nothing to fill and answers what Portal said', async () => {
    // Arrange
    const submit = vi.fn<WorkProgressDeps['submit']>(async () => ({ ok: true, outcome: { outcome: 'done', response: { text: '' } } }) as never);
    const deps: WorkProgressDeps = { open: async () => ({ ok: true, data: { commandId: 'c1' } as never }), submit, notice: async () => null };
    // Act
    const result = await sendWorkStreetDelete(deps);
    // Assert
    expect(submit).toHaveBeenCalledWith('c1', {});
    expect(result).toEqual({ ok: true, message: STREET_DELETED });
  });

  it('a street with progress comes back refused with Portal\'s words', async () => {
    const deps: WorkProgressDeps = { open: async () => ({ ok: true, data: { commandId: 'c1' } as never }), submit: async () => ({ ok: false, message: 'La calle tiene avance registrado.' }) as never, notice: async () => null };
    expect(await sendWorkStreetDelete(deps)).toEqual({ ok: false, message: 'La calle tiene avance registrado.' });
  });

  it('without signal it says to try again', async () => {
    const deps: WorkProgressDeps = { open: async () => ({ ok: false }), submit: vi.fn(), notice: async () => null };
    expect(await sendWorkStreetDelete(deps)).toEqual({ ok: false, message: STREET_DELETE_FAILED });
  });

  it('reloads the map only after Portal deleted it', async () => {
    const reload = vi.fn(async () => undefined);
    await deleteThenReload(async () => ({ ok: false, message: 'no' }), reload)!('s1');
    expect(reload).not.toHaveBeenCalled();
    await deleteThenReload(async () => ({ ok: true, message: 'sí' }), reload)!('s1');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(deleteThenReload(undefined, reload)).toBeUndefined();
  });

  it('walks the question: sending, then closed, or open again with the refusal', async () => {
    const steps: unknown[] = [];
    await runStreetDelete(async () => ({ ok: false, message: 'Tiene avance.' }), 's1', (state) => steps.push(state));
    expect(steps).toEqual([{ asking: true, busy: true, error: null }, { asking: true, busy: false, error: 'Tiene avance.' }]);
    steps.length = 0;
    await runStreetDelete(async () => ({ ok: true, message: 'ok' }), 's1', (state) => steps.push(state));
    expect(steps.at(-1)).toEqual(STREET_DELETE_IDLE);
  });
});

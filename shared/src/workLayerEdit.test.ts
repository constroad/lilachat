import { describe, expect, it } from 'vitest';
import { deleteLayer, layerActionOpen, layerTestId, renameLayer, runLayerAction, type LayerActionState, layerDeleteRequest, layerEditProblem, layerEditRequest, LAYER_NAME_TAKEN, layerDeleteQuestion } from './workLayerEdit.js';
import { LABEL_NEEDS_NAME } from './workScopeDraft.js';

/** Renaming and deleting a stage or a work from the map (Portal c1c35c58, asked 08/11 while writing tutorial 2). */
describe('renaming a stage or a work', () => {
  it('sends the id and the trimmed name, by the kind', () => {
    expect(layerEditRequest('stages', 'e1', '  Frente 2 ')).toEqual({ kind: 'work_stage_edit', stage_id: 'e1', name: 'Frente 2', forms: expect.any(Number) });
    expect(layerEditRequest('works', 't1', 'Bacheo')).toEqual({ kind: 'work_tag_edit', tag_id: 't1', name: 'Bacheo', forms: expect.any(Number) });
  });

  it('says what is wrong before sending: empty, or the name another one already has', () => {
    const others = [{ id: 'e1', name: 'Etapa 1' }, { id: 'e2', name: 'Frente Norte' }];
    expect(layerEditProblem(' ', 'e1', others)).toBe(LABEL_NEEDS_NAME);
    expect(layerEditProblem(' frente  norte ', 'e1', others)).toBe(LAYER_NAME_TAKEN);
    expect(layerEditProblem('Etapa 1', 'e1', others)).toBeNull();
    expect(layerEditProblem('Etapa 3', 'e1', others)).toBeNull();
  });
});

describe('deleting a stage or a work', () => {
  it('sends only its id', () => {
    expect(layerDeleteRequest('stages', 'e1')).toEqual({ kind: 'work_stage_delete', stage_id: 'e1', forms: expect.any(Number) });
    expect(layerDeleteRequest('works', 't1')).toEqual({ kind: 'work_tag_delete', tag_id: 't1', forms: expect.any(Number) });
  });

  it('asks naming what happens to its stretches', () => {
    expect(layerDeleteQuestion('stages', 'Etapa 2')).toBe('¿Borrar la etapa «Etapa 2»? Sus tramos quedan sin etapa. Un admin puede restaurarla.');
    expect(layerDeleteQuestion('works', 'Bacheo')).toBe('¿Borrar el trabajo «Bacheo»? Sus tramos quedan sin él. Un trabajo con avance registrado no se borra. Un admin puede restaurarlo.');
  });
});

describe('renameLayer and deleteLayer, through the door', () => {
  it('a wrong name never leaves the phone; Portal\'s refusal comes back as the message', async () => {
    // Arrange
    const sent: unknown[] = [];
    const ok = async (request: unknown) => { sent.push(request); return { ok: true as const, message: 'x' }; };
    const refused = async () => ({ ok: false as const, message: 'Ya hay una etapa «Etapa 1» en este servicio.' });
    // Act + Assert
    expect(await renameLayer(ok, 'stages', 'e2', ' ', [])).toBe(LABEL_NEEDS_NAME);
    expect(sent).toEqual([]);
    expect(await renameLayer(ok, 'stages', 'e2', 'Frente 2', [])).toBeNull();
    expect(await renameLayer(refused, 'stages', 'e2', 'Etapa 1', [])).toBe('Ya hay una etapa «Etapa 1» en este servicio.');
    expect(await deleteLayer(ok, 'works', 't1')).toBeNull();
    expect(sent).toEqual([expect.objectContaining({ kind: 'work_stage_edit' }), expect.objectContaining({ kind: 'work_tag_delete', tag_id: 't1' })]);
  });
});

describe('the card\'s state', () => {
  it('goes back to idle when Portal took it, and keeps the field open with its message when not', async () => {
    let state: LayerActionState = layerActionOpen('rename', 'Etapa 1');
    const update = (change: (before: LayerActionState) => LayerActionState) => { state = change(state); };
    await runLayerAction(async () => 'Ya hay una etapa «X» en este servicio.', update);
    expect(state).toEqual({ mode: 'rename', draft: 'Etapa 1', error: 'Ya hay una etapa «X» en este servicio.', busy: false });
    await runLayerAction(async () => null, update);
    expect(state).toMatchObject({ mode: 'idle', error: null, busy: false });
    expect(layerTestId('works', 't1')).toBe('trabajo-t1');
  });
});

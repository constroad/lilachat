import { describe, expect, it } from 'vitest';
import { isWorkMapFormKind, workMapFormInputOf, workMapFormPrepared } from './workMapForms.js';

/** Step 3 of the map (José 07/11: «itera hasta terminarlo»): stretches, stages, works and what was deleted, through the door. */
const ENTRY = '0b7e7d0e-6a8f-4c3b-9d2e-1f2a3b4c5d6e';
const SERVICE = 'srv-318';

describe('a stretch of a street (design o-03)', () => {
  it('a new one carries the street, the stations, its works split in tags and partidas, its stage and the entry', () => {
    // Arrange
    const raw = { kind: 'work_scope', street_id: 'st-1', from_m: 0, to_m: 160, tag_ids: ['tg-1'], partida_ids: ['pt-1'], stage_id: 'sg-1', width_m: 6, entry_id: ENTRY };
    // Act
    const input = workMapFormInputOf(raw);
    // Assert
    expect(input).not.toBeNull();
    expect(workMapFormPrepared(SERVICE, input!)).toEqual({
      form: { id: 'guardar_tramo_de_obra', title: 'Guardar tramo', submitLabel: 'Guardar', schema: { type: 'object', properties: {} } },
      context: { servicioId: SERVICE, calleId: 'st-1', desdeM: 0, hastaM: 160, etiquetaIds: ['tg-1'], partidaIds: ['pt-1'], etapaId: 'sg-1', anchoM: 6, entradaId: ENTRY },
    });
  });

  it('an edit names the stretch, needs no entry, and «sin etapa» clears the stage', () => {
    const input = workMapFormInputOf({ kind: 'work_scope', street_id: 'st-1', scope_id: 'sc-9', from_m: 10, to_m: 20, stage_id: null });
    expect(workMapFormPrepared(SERVICE, input!).context).toEqual({ servicioId: SERVICE, calleId: 'st-1', tramoId: 'sc-9', desdeM: 10, hastaM: 20, etapaId: null });
  });

  it('refuses what Portal would refuse: no street, an end before the start, a new one without entry, a bad width', () => {
    expect(workMapFormInputOf({ kind: 'work_scope', from_m: 0, to_m: 10, entry_id: ENTRY })).toBeNull();
    expect(workMapFormInputOf({ kind: 'work_scope', street_id: 'st-1', from_m: 20, to_m: 10, entry_id: ENTRY })).toBeNull();
    expect(workMapFormInputOf({ kind: 'work_scope', street_id: 'st-1', from_m: -1, to_m: 10, entry_id: ENTRY })).toBeNull();
    expect(workMapFormInputOf({ kind: 'work_scope', street_id: 'st-1', from_m: 0, to_m: 10 })).toBeNull();
    expect(workMapFormInputOf({ kind: 'work_scope', street_id: 'st-1', from_m: 0, to_m: 10, width_m: 0, entry_id: ENTRY })).toBeNull();
    expect(workMapFormInputOf({ kind: 'work_scope', street_id: 'st-1', from_m: 0, to_m: 10, tag_ids: 'tg-1', entry_id: ENTRY })).toBeNull();
    expect(workMapFormInputOf({ kind: 'work_scope', street_id: 'st-1', from_m: 0, to_m: 10, tag_ids: Array.from({ length: 31 }, (_, index) => `tg-${index}`), entry_id: ENTRY })).toBeNull();
  });

  it('deleting one sends only the stretch', () => {
    const input = workMapFormInputOf({ kind: 'work_scope_delete', scope_id: 'sc-9' });
    expect(workMapFormPrepared(SERVICE, input!)).toMatchObject({ form: { id: 'borrar_tramo_de_obra', title: 'Borrar tramo' }, context: { servicioId: SERVICE, tramoId: 'sc-9' } });
    expect(workMapFormInputOf({ kind: 'work_scope_delete' })).toBeNull();
  });
});

describe('stages and works (designs o-04 and o-05)', () => {
  it('a stage is a name', () => {
    const input = workMapFormInputOf({ kind: 'work_stage', name: '  Etapa 2 ' });
    expect(workMapFormPrepared(SERVICE, input!)).toMatchObject({ form: { id: 'crear_etapa_de_obra' }, context: { servicioId: SERVICE, nombre: 'Etapa 2' } });
    expect(workMapFormInputOf({ kind: 'work_stage', name: ' ' })).toBeNull();
    expect(workMapFormInputOf({ kind: 'work_stage', name: 'x'.repeat(61) })).toBeNull();
  });

  it('a work is a name and a six-digit color', () => {
    const input = workMapFormInputOf({ kind: 'work_tag', name: 'Bacheo', color: '#0d9488' });
    expect(workMapFormPrepared(SERVICE, input!)).toMatchObject({ form: { id: 'crear_etiqueta_de_obra' }, context: { servicioId: SERVICE, nombre: 'Bacheo', color: '#0d9488' } });
    expect(workMapFormInputOf({ kind: 'work_tag', name: 'Bacheo', color: 'teal' })).toBeNull();
    expect(workMapFormInputOf({ kind: 'work_tag', name: 'Bacheo' })).toBeNull();
  });
});

describe('what was deleted (admins restore it)', () => {
  it('restores a street or a stretch, one of the two', () => {
    expect(workMapFormPrepared(SERVICE, workMapFormInputOf({ kind: 'work_restore', street_id: 'st-1' })!).context).toEqual({ servicioId: SERVICE, calleId: 'st-1' });
    expect(workMapFormPrepared(SERVICE, workMapFormInputOf({ kind: 'work_restore', scope_id: 'sc-9' })!).context).toEqual({ servicioId: SERVICE, tramoId: 'sc-9' });
    expect(workMapFormInputOf({ kind: 'work_restore' })).toBeNull();
    expect(workMapFormInputOf({ kind: 'work_restore', street_id: 'st-1', scope_id: 'sc-9' })).toBeNull();
  });

  it('the list of what was deleted asks only for the service', () => {
    expect(workMapFormPrepared(SERVICE, workMapFormInputOf({ kind: 'work_deleted' })!)).toMatchObject({ form: { id: 'borrados_de_obra' }, context: { servicioId: SERVICE } });
  });

  it('the door opens them since agentes checks their service (890b02e)', () => {
    expect(isWorkMapFormKind('work_restore')).toBe(true);
    expect(isWorkMapFormKind('work_deleted')).toBe(true);
    expect(isWorkMapFormKind('work_street')).toBe(false);
  });

  it('another kind is not this module\'s', () => {
    expect(workMapFormInputOf({ kind: 'work_street' })).toBeNull();
  });
});

describe('«Crear enlace de avance» (o-08, Portal 1d397594)', () => {
  it('carries the cut and the photos; the service is the door\'s', () => {
    const input = workMapFormInputOf({ kind: 'work_progress_link', stage_id: 'e1', until: '2026-11-06', photos: true });
    expect(workMapFormPrepared(SERVICE, input!)).toEqual({
      form: { id: 'crear_enlace_de_avance', title: 'Enlace de avance', submitLabel: 'Crear enlace', schema: { type: 'object', properties: {} } },
      context: { servicioId: SERVICE, etapaId: 'e1', hasta: '2026-11-06', mostrarFotos: true },
    });
    expect(workMapFormPrepared(SERVICE, workMapFormInputOf({ kind: 'work_progress_link', photos: false })!).context).toEqual({ servicioId: SERVICE, mostrarFotos: false });
    expect(isWorkMapFormKind('work_progress_link')).toBe(true);
  });

  it.each([[{ until: 'ayer', photos: true }], [{ photos: 'si' }], [{ stage_id: 7, photos: false }]])('refuses %o', (change) => {
    expect(workMapFormInputOf({ kind: 'work_progress_link', ...change })).toBeNull();
  });
});

describe('«Importar KMZ o KML» (o-12, Portal abc01353)', () => {
  const MEDIA = '6aef8d455e4b25190f7c3177';
  it('reviews with the Drive file alone, and confirms with an entry', () => {
    expect(workMapFormPrepared(SERVICE, workMapFormInputOf({ kind: 'work_import', media_id: MEDIA, confirm: false })!).context).toEqual({ servicioId: SERVICE, mediaId: MEDIA, confirmar: false });
    const confirm = workMapFormPrepared(SERVICE, workMapFormInputOf({ kind: 'work_import', media_id: MEDIA, confirm: true, entry_id: ENTRY })!);
    expect(confirm.form.id).toBe('importar_calles_de_obra');
    expect(confirm.context).toEqual({ servicioId: SERVICE, mediaId: MEDIA, confirmar: true, entradaId: ENTRY });
  });

  it.each([[{ media_id: '../x', confirm: false }], [{ media_id: MEDIA, confirm: true }], [{ media_id: MEDIA, confirm: false, entry_id: ENTRY }]])('refuses %o', (change) => {
    expect(workMapFormInputOf({ kind: 'work_import', ...change })).toBeNull();
  });
});

describe('«PDF del avance» (o-08 and o-12, Portal 02cfceef)', () => {
  it('the client sheet and the plan with its size and works; the service is the door\'s', () => {
    expect(workMapFormPrepared(SERVICE, workMapFormInputOf({ kind: 'work_progress_pdf', stage_id: 'e1', until: '2026-11-06', format: 'client' })!)).toEqual({
      form: { id: 'pdf_de_avance_de_obra', title: 'PDF del avance', submitLabel: 'Generar', schema: { type: 'object', properties: {} } },
      context: { servicioId: SERVICE, etapaId: 'e1', hasta: '2026-11-06', formato: 'cliente' },
    });
    expect(workMapFormPrepared(SERVICE, workMapFormInputOf({ kind: 'work_progress_pdf', format: 'plan', size: 'A1', work_ids: ['base'] })!).context).toEqual({ servicioId: SERVICE, formato: 'plano', tamano: 'A1', trabajoIds: ['base'] });
  });

  it.each([[{ format: 'word' }], [{ format: 'plan', size: 'A0' }], [{ format: 'client', until: 'hoy' }], [{ format: 'plan', work_ids: 'base' }]])('refuses %o', (change) => {
    expect(workMapFormInputOf({ kind: 'work_progress_pdf', ...change })).toBeNull();
  });
});

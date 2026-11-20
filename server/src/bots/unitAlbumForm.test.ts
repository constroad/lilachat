import { describe, expect, it } from 'vitest';
import { unitAlbumInputOf, unitAlbumPrepared } from './unitAlbumForm.js';

/** «Terminar unidad» (José 19/11): what the phone may send to `enviar_fotos_de_unidad`. */
const valid = { kind: 'unit_album', report_id: '6aed0a1b2c3d4e5f60718293', tramo_id: 'd1', fotos: ['https://x/a.jpg', 'https://x/b.jpg'] };

describe('the album a phone sends', () => {
  it('takes the report, the unit and the urls in order', () => {
    expect(unitAlbumInputOf(valid)).toEqual({ kind: 'unit_album', reportId: valid.report_id, tramoId: 'd1', urls: valid.fotos });
  });

  it('keeps each url once', () => {
    expect(unitAlbumInputOf({ ...valid, fotos: ['https://x/a.jpg', ' https://x/a.jpg ', 'https://x/b.jpg'] })?.urls).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
  });

  it.each([
    ['no report', { report_id: '' }],
    ['a report id off the pattern', { report_id: 'r 1/..' }],
    ['no unit', { tramo_id: '' }],
    ['a unit id too long', { tramo_id: 'x'.repeat(65) }],
    ['no photos', { fotos: [] }],
    ['photos not a list', { fotos: 'https://x/a.jpg' }],
    ['a photo that is not a web address', { fotos: ['javascript:alert(1)'] }],
    ['a photo that is not text', { fotos: [42] }],
    ['more photos than a unit holds', { fotos: Array.from({ length: 41 }, (_, index) => `https://x/${index}.jpg`) }],
  ])('refuses %s', (_case, change) => {
    expect(unitAlbumInputOf({ ...valid, ...change })).toBeNull();
  });
});

describe('the form it opens', () => {
  it('has nothing to fill, and carries the service from the door', () => {
    // Arrange
    const input = unitAlbumInputOf(valid)!;
    // Act
    const prepared = unitAlbumPrepared('srv-318', input);
    // Assert
    expect(prepared.form).toMatchObject({ id: 'enviar_fotos_de_unidad', schema: { properties: {} } });
    expect(prepared.context).toEqual({ servicioId: 'srv-318', informeId: valid.report_id, tramoId: 'd1', fotos: valid.fotos });
  });
});

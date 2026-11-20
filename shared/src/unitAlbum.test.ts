import { describe, expect, it } from 'vitest';
import { fieldDocumentOf, type RepeatItem, type RepeatSection } from './fieldDocument';
import { sectionPhotos } from './reportSaves';
import { ALBUM_CTA, albumClosesUnit, albumCountLine, albumReviewTitle, albumSelection, albumSendLabel, albumSentNote, albumViewOf, freshAlbumMarks, markAlbumPhotoBroken, toggleAlbumPhoto, unitAlbumCta, unitAlbumOf } from './unitAlbum';

/** A control de pista unit as Portal lists it (19/11): the template is NOT in capture order on purpose. */
const photoEntry = (kind: string, title = `Foto de ${kind}`) => ({ id: `foto-${kind}`, title, required: kind !== 'adicional', form: 'fotos', tool: kind === 'adicional' ? 'agregar_foto_adicional' : 'agregar_foto_de_informe', photoKind: kind });
const shot = (name: string, extra: Record<string, unknown> = {}) => ({ id: name, url: `https://x/${name}.jpg`, thumb_url: `https://x/${name}-t.jpg`, hora: '08:10', ...extra });
const template = [{ id: 'datos', title: 'Datos', required: true, form: 'unidad' }, photoEntry('vacia', 'Unidad vacía · cierra la unidad'), photoEntry('ingreso'), photoEntry('escantillon'), photoEntry('temperatura'), photoEntry('adicional')];

function unitWith(photos: Partial<Record<string, unknown[]>>, extra: Record<string, unknown> = {}): RepeatItem {
  const sections = Object.entries(photos).map(([kind, fotos]) => ({ id: `foto-${kind}`, state: fotos?.length ? 'done' : 'empty', values: { fotos } }));
  const body = {
    id: 'r1', type: 'CTL-PIS', title: 'Control de pista', status: 'draft',
    forms: { unidad: { type: 'object', properties: { horaLlegada: { type: 'string', title: 'Hora' } } }, fotos: { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' } } } },
    sections: [{ id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'partial', summary: [], results: [], itemTitle: 'Unidad', addLabel: '', min: 1, template, items: [{ id: 'd1', title: 'Unidad 3 · QAP-101', summary: [], results: [], sections, ...extra }] }],
    publish: { label: 'Publicar informe', missing: [] },
  };
  return (fieldDocumentOf(body)!.sections[0] as RepeatSection).items[0]!;
}

const fullUnit = (extra: Record<string, unknown> = {}) => unitWith({ vacia: [shot('v')], ingreso: [shot('i')], escantillon: [shot('e')], temperatura: [shot('t')], adicional: [shot('x1', { descripcion: 'Rodillo' }), shot('x2')] }, extra);

describe('the album of a unit (José 19/11)', () => {
  it('lists the photos in capture order: ingreso, temperatura, escantillón, vacía, then the extras', () => {
    // Arrange
    const item = fullUnit();
    // Act
    const album = unitAlbumOf(item);
    // Assert
    expect(album.map((one) => one.url)).toEqual(['i', 't', 'e', 'v', 'x1', 'x2'].map((name) => `https://x/${name}.jpg`));
    expect(album[0]).toEqual({ url: 'https://x/i.jpg', thumbUrl: 'https://x/i-t.jpg', label: 'Ingreso', hour: '08:10' });
    expect(album[3]?.label).toBe('Unidad vacía');
    expect(album.slice(4).map((one) => one.label)).toEqual(['Rodillo', 'Adicional']);
  });

  it('is empty for a unit with no photo', () => {
    expect(unitAlbumOf(unitWith({}))).toEqual([]);
  });

  it('leaves out a photo still on the phone, and a url Portal listed twice', () => {
    // Arrange
    const item = unitWith({ ingreso: [shot('i'), shot('i')], temperatura: [shot('p', { pending: true })] });
    // Act and assert
    expect(unitAlbumOf(item).map((one) => one.url)).toEqual(['https://x/i.jpg']);
  });

  it('holds only the extras when the fixed photos are missing', () => {
    expect(unitAlbumOf(unitWith({ adicional: [shot('x1')] })).map((one) => one.label)).toEqual(['Adicional']);
  });
});

describe('the button of a unit', () => {
  it('is «Terminar unidad» on an open unit for an admin', () => {
    expect(unitAlbumCta(unitWith({ ingreso: [shot('i')] }), true)).toEqual({ label: ALBUM_CTA.finish });
  });

  it('is nothing for a member, even with photos', () => {
    expect(unitAlbumCta(fullUnit(), false)).toBeNull();
  });

  it('is nothing for a unit with no photo', () => {
    expect(unitAlbumCta(unitWith({}), true)).toBeNull();
  });

  it('shows for a unit with only extras', () => {
    expect(unitAlbumCta(unitWith({ adicional: [shot('x1')] }), true)?.label).toBe(ALBUM_CTA.finish);
  });

  it('sends the photos of a closed unit not sent yet', () => {
    expect(unitAlbumCta(fullUnit(), true)).toEqual({ label: ALBUM_CTA.send });
  });

  it('resends once Portal says it went, with when', () => {
    // Arrange
    const item = fullUnit({ albumEnviadoAt: '2026-11-19T15:42:00.000Z' });
    // Act and assert
    expect(item.albumSentAt).toBe('2026-11-19T15:42:00.000Z');
    expect(unitAlbumCta(item, true)).toEqual({ label: ALBUM_CTA.resend, sentNote: 'Enviadas al grupo el 19/11 a las 10:42' });
  });

  it('ignores a sent date that is not a date', () => {
    expect(unitAlbumCta(fullUnit({ albumEnviadoAt: 'ayer' }), true)).toEqual({ label: ALBUM_CTA.send });
  });
});

describe('Portal’s marks on the document, optional', () => {
  it('a photo carries `alGrupo` when Portal says it, and nothing when it does not', () => {
    // Arrange
    const values = { fotos: [shot('a', { alGrupo: true }), shot('b', { alGrupo: false }), shot('c')] };
    // Act
    const photos = sectionPhotos({ values });
    // Assert
    expect(photos.map((one) => one.toGroup)).toEqual([true, false, undefined]);
    expect(photos[2]).not.toHaveProperty('toGroup');
  });

  it('a unit without `albumEnviadoAt` has no sent date', () => {
    expect(fullUnit()).not.toHaveProperty('albumSentAt');
  });
});

describe('the review before sending', () => {
  const album = unitAlbumOf(fullUnit());

  it('opens with every photo checked', () => {
    expect(albumSelection(album, freshAlbumMarks())).toHaveLength(6);
  });

  it('a tap unchecks a photo and a second tap checks it again, keeping the order', () => {
    // Arrange
    const once = toggleAlbumPhoto(freshAlbumMarks(), 'https://x/t.jpg');
    // Act
    const twice = toggleAlbumPhoto(once, 'https://x/t.jpg');
    // Assert
    expect(albumSelection(album, once)).not.toContain('https://x/t.jpg');
    expect(albumSelection(album, twice)).toEqual(album.map((one) => one.url));
  });

  it('a photo that did not open is out and cannot be checked', () => {
    // Arrange
    const broken = markAlbumPhotoBroken(freshAlbumMarks(), 'https://x/i.jpg');
    // Act
    const tapped = toggleAlbumPhoto(broken, 'https://x/i.jpg');
    // Assert
    expect(albumSelection(album, tapped)).not.toContain('https://x/i.jpg');
    expect(markAlbumPhotoBroken(broken, 'https://x/i.jpg')).toBe(broken);
  });

  it('says how many go, and the button is plain at zero', () => {
    expect([albumCountLine(0), albumCountLine(1), albumCountLine(6)]).toEqual(['Se enviarán 0 fotos', 'Se enviará 1 foto', 'Se enviarán 6 fotos']);
    expect([albumSendLabel(0), albumSendLabel(1), albumSendLabel(6)]).toEqual(['Enviar fotos al grupo', 'Enviar 1 foto al grupo', 'Enviar 6 fotos al grupo']);
  });

  it('names the unit, or its plate when Portal gave no number', () => {
    expect(albumReviewTitle({ title: 'Unidad 3 · QAP-101' })).toBe('Revisa las fotos de la Unidad 3');
    expect(albumReviewTitle({ title: 'QAP-103' })).toBe('Revisa las fotos de QAP-103');
  });

  it('warns that an open unit closes, and not a closed one', () => {
    expect(albumClosesUnit(unitWith({ ingreso: [shot('i')] }))).toBe(true);
    expect(albumClosesUnit(fullUnit())).toBe(false);
  });

  it('writes the sent hour in Lima', () => {
    expect(albumSentNote('2026-11-20T02:05:00.000Z')).toBe('Enviadas al grupo el 19/11 a las 21:05');
  });
});

describe('the viewer from the review', () => {
  const album = unitAlbumOf(fullUnit());

  it('opens on the tapped photo with the whole album to swipe', () => {
    // Act
    const view = albumViewOf(album, 'https://x/t.jpg');
    // Assert
    expect(view?.file).toEqual({ url: 'https://x/t.jpg', name: 'Temperatura · 08:10', mime: 'image/jpeg', thumbUrl: 'https://x/t-t.jpg' });
    expect(view?.siblings).toHaveLength(6);
  });

  it('is nothing for a url off the album', () => {
    expect(albumViewOf(album, 'https://x/otra.jpg')).toBeNull();
  });
});

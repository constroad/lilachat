import { describe, expect, it } from 'vitest';
import { DRIVE_KINDS, DRIVE_UPLOAD_OPTIONS, driveDayGroups, driveKindOf, filesOfKind } from './driveView.js';
import type { ServiceFile } from './serviceFiles.js';

/**
 * José 13/11: «nunca vi un diseño con varios botones en un drive». The Drive of a service has ONE
 * «Subir» with a menu, a list / grid switch and the chips Todo · Fotos · Videos · Documentos
 * (designs drv-01, drv-02, drv-03).
 */
const file = (name: string, mime: string, modifiedAt?: string): ServiceFile => ({ name, mime, url: `https://x/${name}`, ...(modifiedAt ? { modifiedAt } : {}) });
const photo = file('tramo-2.jpg', 'image/jpeg', '2026-11-13T15:00:00Z');
const video = file('riego.mp4', 'video/mp4', '2026-11-13T04:30:00Z');
const pdf = file('acta.pdf', 'application/pdf', '2026-10-21T12:00:00Z');
const sheet = file('metrado.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

describe('driveKindOf and filesOfKind', () => {
  it('a photo, a video and anything else (PDF, Excel) is a document', () => {
    // Act / Assert
    expect([photo, video, pdf, sheet].map((one) => driveKindOf(one.mime))).toEqual(['photo', 'video', 'document', 'document']);
  });

  it('each chip keeps only its kind, «Todo» keeps everything in order', () => {
    // Arrange
    const files = [photo, video, pdf, sheet];
    // Act / Assert
    expect(filesOfKind(files, 'all')).toEqual(files);
    expect(filesOfKind(files, 'photo')).toEqual([photo]);
    expect(filesOfKind(files, 'video')).toEqual([video]);
    expect(filesOfKind(files, 'document')).toEqual([pdf, sheet]);
    expect(DRIVE_KINDS.map((one) => one.label)).toEqual(['Todo', 'Fotos', 'Videos', 'Documentos']);
  });
});

describe('driveDayGroups', () => {
  it('groups the grid by the day in Lima, today first and marked «Hoy», a file with no date last', () => {
    // Arrange: 04:30 UTC on the 13th is still the 12th in Lima.
    const now = new Date('2026-11-13T18:00:00Z');
    // Act
    const groups = driveDayGroups([photo, video, pdf, sheet], now);
    // Assert
    expect(groups.map((group) => [group.label, group.files.map((one) => one.name)])).toEqual([
      ['Hoy · 13 nov', ['tramo-2.jpg']],
      ['12 nov', ['riego.mp4']],
      ['21 oct', ['acta.pdf']],
      ['Sin fecha', ['metrado.xlsx']],
    ]);
  });

  it('an empty Drive has no groups, and a bad date counts as no date', () => {
    // Act / Assert
    expect(driveDayGroups([], new Date())).toEqual([]);
    expect(driveDayGroups([file('x.pdf', 'application/pdf', 'nunca')], new Date()).map((group) => group.label)).toEqual(['Sin fecha']);
  });
});

describe('DRIVE_UPLOAD_OPTIONS', () => {
  it('one «Subir» opens four ways in, in the order of the design, each saying what it takes', () => {
    // Assert
    expect(DRIVE_UPLOAD_OPTIONS.map((one) => one.id)).toEqual(['photo', 'video', 'gallery', 'document']);
    expect(DRIVE_UPLOAD_OPTIONS.map((one) => one.title)).toEqual(['Tomar foto', 'Grabar video', 'Desde la galería', 'Documento']);
    expect(DRIVE_UPLOAD_OPTIONS.find((one) => one.id === 'video')!.detail).toBe('Hasta 1 min, con fecha, hora y lugar');
    expect(DRIVE_UPLOAD_OPTIONS.find((one) => one.id === 'document')!.detail).toBe('PDF, Word, Excel o PowerPoint');
  });
});

import { describe, expect, it } from 'vitest';
import { DRIVE_PASTE_HINT, driveFileActions, driveNoticeDone, driveSheetLine, MEDIA_OPEN_IN_CHAT, mediaItemAsFile, pastedDriveName } from './driveFileActions.js';
import type { MediaLibraryItem } from './mediaLibrary.js';
import type { ServiceFile } from './serviceFiles.js';

const file = (mime: string, id?: string): ServiceFile => ({ name: 'parche-12-antes.jpg', mime, url: 'https://drive.example/f', ...(id ? { id } : {}) });

describe('driveFileActions', () => {
  it('a photo Portal sent with its id, in the order of design cc-05 mobile', () => {
    expect(driveFileActions(file('image/jpeg', 'f1'), { copiesFiles: true, shares: true }).map((one) => one.id)).toEqual(['open', 'copy_link', 'copy_file', 'share', 'phase', 'download']);
  });
  it('a document is not copied as a file nor marked: the clipboard only carries images', () => {
    expect(driveFileActions(file('application/pdf', 'f2'), { copiesFiles: true }).map((one) => one.id)).toEqual(['open', 'copy_link', 'download']);
  });
  it('without a way to copy a file nor a share sheet (an old browser) the photo keeps the rest', () => {
    expect(driveFileActions(file('image/png'), { copiesFiles: false }).map((one) => one.id)).toEqual(['open', 'copy_link', 'download']);
  });
  it('labels read as the design, the mark with its second line', () => {
    // Arrange / Act
    const actions = driveFileActions(file('image/jpeg', 'f1'), { copiesFiles: true, shares: true });
    // Assert
    expect(actions.map((one) => one.label)).toEqual(['Abrir vista previa', 'Copiar enlace', 'Copiar archivo', 'Compartir', 'Marcar como antes / después', 'Descargar']);
    expect(actions.find((one) => one.id === 'phase')?.hint).toBe('Vincula esta foto al reporte fotográfico');
    expect(actions.find((one) => one.id === 'open')?.hint).toBeUndefined();
  });
  it('«Medios» opens the file at its chat message', () => {
    expect(driveFileActions(file('image/jpeg'), { copiesFiles: true, openLabel: MEDIA_OPEN_IN_CHAT })[0]!.label).toBe('Ver en el chat');
  });
});

describe('driveSheetLine', () => {
  const now = new Date('2026-11-19T17:00:00Z');
  it('reads «Hoy 09:40 · Fotos de obra · 1.8 MB» (design cc-05 mobile)', () => {
    expect(driveSheetLine({ modifiedAt: '2026-11-19T14:40:00Z', folder: 'Fotos de obra', sizeBytes: 1_887_437 }, now)).toBe('Hoy 09:40 · Fotos de obra · 1.8 MB');
  });
  it('leaves out what is missing or broken', () => {
    expect(driveSheetLine({ modifiedAt: 'ayer', sizeBytes: 524_288 }, now)).toBe('0.5 MB');
    expect(driveSheetLine({}, now)).toBe('');
  });
});

describe('mediaItemAsFile', () => {
  const item = (overrides: Partial<MediaLibraryItem>): MediaLibraryItem => ({ chatId: 'c1', seq: 4, at: '2026-11-18T15:00:00Z', senderId: 'u1', kind: 'image', chat: { kind: 'group', name: 'Obra Grau' }, ...overrides });
  it('a photo of «Medios» gets the sheet with its chat as folder, without the before/after mark', () => {
    // Arrange
    const photo = item({ media: { url: 'https://lilachat.constroad.com/files/a.jpg', thumbUrl: 'https://lilachat.constroad.com/files/a-t.jpg', mime: 'image/jpeg', sizeBytes: 2048 } });
    // Act
    const asFile = mediaItemAsFile(photo, 'Obra Grau');
    // Assert
    expect(asFile).toEqual({ name: 'a.jpg', mime: 'image/jpeg', url: 'https://lilachat.constroad.com/files/a.jpg', thumbUrl: 'https://lilachat.constroad.com/files/a-t.jpg', folder: 'Obra Grau', modifiedAt: '2026-11-18T15:00:00Z', sizeBytes: 2048 });
    expect(driveFileActions(asFile!, { copiesFiles: true }).map((one) => one.id)).not.toContain('phase');
  });
  it('a document keeps its name; a link or a file without url has no sheet', () => {
    expect(mediaItemAsFile(item({ kind: 'file', media: { url: 'https://x/f.pdf', fileName: 'Informe.pdf' } }), 'Obra')?.name).toBe('Informe.pdf');
    expect(mediaItemAsFile(item({ kind: 'file', media: { url: 'https://x/f' } }), 'Obra')?.mime).toBe('application/octet-stream');
    expect(mediaItemAsFile(item({ kind: 'text', link: 'https://x.com' }), 'Obra')).toBeNull();
    expect(mediaItemAsFile(item({ media: {} }), 'Obra')).toBeNull();
  });
});

describe('pastedDriveName', () => {
  const now = new Date(2026, 10, 19, 9, 40, 5);
  it('keeps a pasted file its own name', () => {
    expect(pastedDriveName('plano.pdf', 'application/pdf', now)).toBe('plano.pdf');
  });
  it('names a pasted screenshot by its time, with the extension of its type', () => {
    expect(pastedDriveName('', 'image/png', now)).toBe('pegado-20261119-094005.png');
    expect(pastedDriveName('image.png', 'image/jpeg', now)).toBe('pegado-20261119-094005.jpg');
  });
  it('says how to paste', () => {
    expect(DRIVE_PASTE_HINT).toContain('Ctrl+V');
  });
});

describe('driveNoticeDone', () => {
  it('a copy that worked carries the check; a failure or a paste message does not', () => {
    expect(driveNoticeDone('Enlace copiado')).toBe(true);
    expect(driveNoticeDone('Imagen copiada')).toBe(true);
    expect(driveNoticeDone('No se pudo copiar. Prueba de nuevo.')).toBe(false);
    expect(driveNoticeDone('No hay una imagen copiada para pegar.')).toBe(false);
  });
});

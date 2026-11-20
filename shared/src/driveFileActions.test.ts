import { describe, expect, it } from 'vitest';
import { DRIVE_PASTE_HINT, driveFileActions, pastedDriveName } from './driveFileActions.js';
import type { ServiceFile } from './serviceFiles.js';

const file = (mime: string, id?: string): ServiceFile => ({ name: 'parche-12-antes.jpg', mime, url: 'https://drive.example/f', ...(id ? { id } : {}) });

describe('driveFileActions', () => {
  it('a photo Portal sent with its id: open, copy its link and the image itself, download, mark before/after', () => {
    expect(driveFileActions(file('image/jpeg', 'f1'), { copiesFiles: true }).map((one) => one.id)).toEqual(['open', 'copy_link', 'copy_file', 'download', 'phase']);
  });
  it('a document is not copied as a file nor marked: the clipboard only carries images', () => {
    expect(driveFileActions(file('application/pdf', 'f2'), { copiesFiles: true }).map((one) => one.id)).toEqual(['open', 'copy_link', 'download']);
  });
  it('without a way to copy a file (an old browser) the photo keeps the rest', () => {
    expect(driveFileActions(file('image/png'), { copiesFiles: false }).map((one) => one.id)).toEqual(['open', 'copy_link', 'download']);
  });
  it('labels read as the design', () => {
    expect(driveFileActions(file('image/jpeg', 'f1'), { copiesFiles: true }).map((one) => one.label)).toEqual(['Abrir', 'Copiar enlace', 'Copiar archivo', 'Descargar', 'Marcar como antes / después']);
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

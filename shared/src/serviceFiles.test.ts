import { describe, expect, it } from 'vitest';
import { SERVICE_FILES_MAX, driveFolders, filesInFolder, searchServiceFiles, serviceFilesOf } from './serviceFiles.js';

/** The service's Drive on demand (pending 121, design f-06): what agentes answers to `client.files.requested`. */
const file = (name: string, folder?: string, extra: object = {}) => ({ name, mime: 'application/pdf', url: `https://lila.constroad.com/f/${name}`, ...(folder ? { folder } : {}), ...extra });

describe('serviceFilesOf', () => {
  it('keeps valid https files and the Drive link; drops the rest', () => {
    const reply = serviceFilesOf({
      files: [file('a.pdf', 'Informes'), { name: 'b.jpg', mime: 'image/jpeg', url: 'http://inseguro/b.jpg' }, { mime: 'x', url: 'https://x/y' }, file('c.jpg', 'Fotos / Día 1', { thumb_url: 'https://x/t.jpg', size_bytes: 2048, modified_at: '2026-10-29T10:00:00Z' })],
      drive_url: 'https://drive.google.com/drive/folders/abc',
    });
    expect(reply?.files.map((one) => one.name)).toEqual(['a.pdf', 'c.jpg']);
    expect(reply?.files[1]).toMatchObject({ thumbUrl: 'https://x/t.jpg', sizeBytes: 2048, folder: 'Fotos / Día 1' });
    expect(reply?.driveUrl).toBe('https://drive.google.com/drive/folders/abc');
  });

  it('a null drive_url is fine; a broken body is null; more than the cap is cut', () => {
    expect(serviceFilesOf({ files: [], drive_url: null })).toEqual({ files: [], driveUrl: null });
    expect(serviceFilesOf({ nada: true })).toBeNull();
    expect(serviceFilesOf(null)).toBeNull();
    const many = Array.from({ length: SERVICE_FILES_MAX + 5 }, (_, index) => file(`${index}.pdf`));
    expect(serviceFilesOf({ files: many, drive_url: null })?.files).toHaveLength(SERVICE_FILES_MAX);
  });
});

describe('folders and search', () => {
  const files = serviceFilesOf({ files: [file('a.pdf', 'Informes'), file('b.jpg', 'Fotos / Día 1'), file('c.jpg', 'Fotos / Día 2'), file('suelto.pdf')], drive_url: null })!.files;

  it('the top folders with how many files each, sub-folders included', () => {
    expect(driveFolders(files)).toEqual([{ name: 'Fotos', count: 2 }, { name: 'Informes', count: 1 }]);
  });

  it('inside a folder, its files; without one, the loose files', () => {
    expect(filesInFolder(files, 'Fotos').map((one) => one.name)).toEqual(['b.jpg', 'c.jpg']);
    expect(filesInFolder(files, null).map((one) => one.name)).toEqual(['suelto.pdf']);
  });

  it('search by name or folder, without accents or case; two letters at least', () => {
    expect(searchServiceFiles(files, 'dia 2').map((one) => one.name)).toEqual(['c.jpg']);
    expect(searchServiceFiles(files, 'INFORM').map((one) => one.name)).toEqual(['a.pdf']);
    expect(searchServiceFiles(files, 'a')).toEqual(files);
  });
});

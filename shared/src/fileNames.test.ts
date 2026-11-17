import { describe, expect, it } from 'vitest';
import { downloadUrlOf, readableFileName } from './fileNames.js';

/** José 17/11: a file of a chat downloads with its own name, as it was sent. */
describe('readableFileName', () => {
  it('decodes a name the picker escaped', () => {
    expect(readableFileName('COTIZACIO%CC%81N%20Alquiler%20Planta%20Asfalto.pdf')).toBe('COTIZACIÓN Alquiler Planta Asfalto.pdf'.normalize('NFD'));
  });

  it('keeps a plain name and drops what breaks a path', () => {
    expect(readableFileName('METRADOS 161126.kml')).toBe('METRADOS 161126.kml');
    expect(readableFileName('obra/planos\\v2.dwg')).toBe('obra planos v2.dwg');
  });

  it('a stray % or an empty name never throws', () => {
    expect(readableFileName('avance 100%.xlsx')).toBe('avance 100%.xlsx');
    expect(readableFileName('  ')).toBe('archivo');
    expect(readableFileName(undefined)).toBe('archivo');
  });
});

/** Our files (`/media/`) answer `?download=<name>` with a download of that name; anyone else's stay as they are. */
describe('downloadUrlOf', () => {
  it('asks our media for a download with the name it was sent with', () => {
    expect(downloadUrlOf('https://lilachat.constroad.com/media/apps/lilachat/c1/file-1_ab.kml', 'METRADOS 161126.kml')).toBe('https://lilachat.constroad.com/media/apps/lilachat/c1/file-1_ab.kml?download=METRADOS%20161126.kml');
  });

  it('decodes an escaped name before asking', () => {
    expect(downloadUrlOf('/media/apps/lilachat/c1/x.xlsx', 'Planilla%20(1).xlsx')).toBe('/media/apps/lilachat/c1/x.xlsx?download=Planilla%20(1).xlsx');
  });

  it('leaves a file on another host as it is', () => {
    expect(downloadUrlOf('https://lila.constroad.com/files/x.pdf', 'a.pdf')).toBe('https://lila.constroad.com/files/x.pdf');
  });
});

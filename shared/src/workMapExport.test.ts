import { describe, expect, it } from 'vitest';
import { lineLengthM, type WorkMap } from './workMap';
import { kmlColor, workMapFileName, workMapKml, workMapKmz, workMapScopeLabel } from './workMapExport';

const LINE = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.99 }];
const LENGTH = lineLengthM(LINE);

const map = (): WorkMap => ({
  streets: [
    { id: 's1', name: 'Av. Perú & Cía.', line: LINE, lengthM: LENGTH },
    { id: 's2', name: 'Jr. Los Pinos', line: [{ lat: -12.01, lng: -77 }, { lat: -12.01, lng: -76.995 }], lengthM: 540 },
  ],
  scopes: [
    { streetId: 's1', fromM: 0, toM: 400, workIds: ['base', 'asfalto'], stageId: 'e1' },
    { streetId: 's2', fromM: 0, toM: 540, workIds: ['base'], stageId: 'e2' },
  ],
  progress: [
    { streetId: 's1', workId: 'base', fromM: 0, toM: 200, date: '2026-11-04', rework: false },
    { streetId: 's1', workId: 'base', fromM: 200, toM: 400, date: '2026-11-05', rework: false },
    { streetId: 's1', workId: 'asfalto', fromM: 0, toM: 120, date: '2026-11-05', rework: false },
  ],
  works: [{ id: 'base', name: 'Base', color: '#b45309' }, { id: 'asfalto', name: 'Asfaltado', color: '#111827' }],
  stages: [{ id: 'e1', name: 'Etapa 1' }, { id: 'e2', name: 'Etapa 2' }],
});

const count = (kml: string, piece: string) => kml.split(piece).length - 1;

describe('kmlColor', () => {
  it('writes alpha first and the channels reversed, the way KML reads them', () => {
    expect(kmlColor('#b45309')).toBe('ff0953b4');
    expect(kmlColor('94a3b8', 'aa')).toBe('aab8a394');
  });

  it('a color it cannot read becomes gray instead of breaking the file', () => {
    expect(kmlColor('hsl(var(--x))')).toBe('ff888888');
  });
});

describe('workMapKml (design o-12: Ejecutado by work, and Pendiente)', () => {
  it('puts each work in its folder, with its stretches named by street and stations', () => {
    // Act
    const kml = workMapKml(map(), {}, 'Pavimentación Los Incas');
    // Assert
    expect(kml.startsWith('<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2">')).toBe(true);
    expect(kml).toContain('<Folder><name>Ejecutado</name><Folder><name>Base</name>');
    expect(kml).toContain('<Folder><name>Asfaltado</name>');
    expect(kml).toContain('<name>Av. Perú &amp; Cía. · 0+000 a 0+120</name>');
    expect(kml).toContain('<Folder><name>Pendiente</name>');
    expect(kml).toContain('<color>ff0953b4</color>');
  });

  it('writes coordinates as lng,lat, or the work lands on the other side of the world', () => {
    expect(workMapKml(map(), {}, 'Obra')).toContain('-77,-12,0');
  });

  it('exports what the map shows: the stage and the day chosen', () => {
    // Act
    const stageTwo = workMapKml(map(), { stageId: 'e2' }, 'Obra');
    const fourth = workMapKml(map(), { untilDay: '2026-11-04' }, 'Obra');
    // Assert: stage 2 has no progress, so only its pending street goes.
    expect(stageTwo).not.toContain('<name>Ejecutado</name>');
    expect(stageTwo).toContain('<name>Jr. Los Pinos</name>');
    expect(stageTwo).not.toContain('Av. Perú');
    expect(count(fourth, '<Placemark>') - count(workMapKml(map(), {}, 'Obra'), '<Placemark>')).toBeLessThan(0);
    expect(fourth).not.toContain('<name>Asfaltado</name>');
  });

  it('escapes the title too', () => {
    expect(workMapKml(map(), {}, 'Obra <1>')).toContain('<Document><name>Obra &lt;1&gt;</name>');
  });
});

describe('workMapKmz', () => {
  it('is a zip that holds doc.kml', () => {
    const zip = workMapKmz('<kml/>');
    expect(new TextDecoder().decode(zip.subarray(30, 37))).toBe('doc.kml');
  });
});

describe('workMapScopeLabel', () => {
  it('says what leaves the map', () => {
    expect(workMapScopeLabel(map(), {})).toBe('Toda la obra · Hasta hoy');
    expect(workMapScopeLabel(map(), { stageId: 'e1', workId: 'asfalto', untilDay: '2026-11-05' })).toBe('Etapa 1 · Asfaltado · Hasta el 5 nov');
  });
});

/** 9 pm in Lima is already the next day in UTC: the name keeps the phone's day. */
const NIGHT = new Date(2026, 10, 7, 21, 0);

describe('workMapFileName', () => {
  it('names the file by the work and the day, without accents or spaces', () => {
    expect(workMapFileName('Pavimentación Av. Los Incas', {}, NIGHT)).toBe('pavimentacion-av-los-incas-2026-11-07.kmz');
    expect(workMapFileName('Obra', { untilDay: '2026-11-05' }, NIGHT)).toBe('obra-2026-11-05.kmz');
  });

  it('a title with nothing to keep still gives a name', () => {
    expect(workMapFileName('¡¿?!', {}, NIGHT)).toBe('mapa-de-la-obra-2026-11-07.kmz');
  });
});

import { describe, expect, it } from 'vitest';
import type { WorkMap, WorkMapPoint } from './workMap.js';
import type { MapPhoto } from './workMapPhotos.js';
import { primeCoatDraftOf, primeCoatExplain, primeCoatGaps, suggestPrimeCoat } from './workPrimeCoat.js';

/** #253 (José 08/11: «no veo cómo se coloca el avance sugerido en base a los procesos de imprimación»). */
const METERS_PER_DEGREE = 111_195;
const START: WorkMapPoint = { lat: -12.05, lng: -77.03 };
const north = (meters: number, sideM = 0): WorkMapPoint => ({ lat: START.lat + meters / METERS_PER_DEGREE, lng: START.lng + sideM / (METERS_PER_DEGREE * Math.cos((START.lat * Math.PI) / 180)) });
const STREET_ID = '6aee73fa80fb948f67e89b8c';
const PRIME = 'imprimacion';
const mapOf = (extra: Partial<WorkMap> = {}): WorkMap => ({
  streets: [{ id: STREET_ID, name: 'Jr. Los Pinos', line: [north(0), north(320)], lengthM: 320 }],
  scopes: [{ id: 'c1', streetId: STREET_ID, fromM: 0, toM: 320, workIds: ['base', PRIME] }],
  progress: [],
  works: [{ id: 'base', name: 'Base', color: '#c08a1e' }, { id: PRIME, name: 'Imprimación', color: '#0f9d8a' }],
  stages: [],
  ...extra,
});
const photo = (id: string, at: WorkMapPoint, extra: Partial<MapPhoto> = {}): MapPhoto => ({ id, ...at, at: '2026-11-06T14:05:00.000Z', kind: 'photo', url: `https://lila.test/${id}.jpg`, thumbnailUrl: `https://lila.test/${id}-t.jpg`, reportType: 'CTL-IMP', reportId: 'r1', ...extra });

describe('suggestPrimeCoat, the stretch the photos of the spraying mark', () => {
  it('goes from the first to the last photo of one report on the street', () => {
    // Act
    const suggestion = suggestPrimeCoat(mapOf(), [photo('p1', north(90)), photo('p2', north(10, 2)), photo('p3', north(50))]);
    // Assert
    expect(suggestion.stretches).toEqual([{ id: `r1|${STREET_ID}`, reportId: 'r1', streetId: STREET_ID, streetName: 'Jr. Los Pinos', fromM: 10, toM: 90, lengthM: 80, photos: 3 }]);
    expect(primeCoatExplain(suggestion.stretches[0]!)).toBe('Las 3 fotos del riego caen entre 0+010 y 0+090 de Jr. Los Pinos. Revisa el tramo y regístralo: recién ahí se suma al avance.');
  });

  it('leaves out the Control de pista and counts the photos off the work', () => {
    const suggestion = suggestPrimeCoat(mapOf(), [photo('p1', north(10)), photo('pista', north(60), { reportType: 'CTL-PIS' }), photo('lejos', north(100, 200))]);
    expect(suggestion.stretches.map((one) => [one.fromM, one.toM])).toEqual([[10, 10]]);
    expect(primeCoatGaps(suggestion)).toBe('1 foto fuera de las calles de la obra');
    expect(primeCoatGaps(suggestPrimeCoat(mapOf(), [photo('p1', north(10))]))).toBeNull();
  });

  it('one stretch per report: two days of spraying are two stretches', () => {
    const suggestion = suggestPrimeCoat(mapOf(), [photo('a', north(0)), photo('b', north(100)), photo('c', north(100), { reportId: 'r2' }), photo('d', north(200), { reportId: 'r2' })]);
    expect(suggestion.stretches.map((one) => [one.reportId, one.fromM, one.toM])).toEqual([['r1', 0, 100], ['r2', 100, 200]]);
  });

  it('once the prime coat is approved over the stretch, it is not suggested again', () => {
    const done = mapOf({ progress: [{ streetId: STREET_ID, workId: PRIME, fromM: 0, toM: 120, date: '2026-11-06', rework: false }] });
    expect(suggestPrimeCoat(done, [photo('p1', north(10)), photo('p2', north(90))]).stretches).toEqual([]);
    expect(suggestPrimeCoat(done, [photo('p1', north(100)), photo('p2', north(180))]).stretches).toHaveLength(1);
  });
});

describe('primeCoatDraftOf, «Registrar avance» already filled', () => {
  it('picks the prime coat work and the range of the photos', () => {
    const map = mapOf();
    const [stretch] = suggestPrimeCoat(map, [photo('p1', north(10)), photo('p2', north(90))]).stretches;
    expect(primeCoatDraftOf(map, stretch!)).toEqual({ workId: PRIME, fromM: 10, toM: 90, photoIds: [], note: '' });
  });

  it('without a prime coat work on the street, the person picks it', () => {
    const map = mapOf({ works: [{ id: 'base', name: 'Base', color: '#c08a1e' }], scopes: [{ id: 'c1', streetId: STREET_ID, fromM: 0, toM: 320, workIds: ['base'] }] });
    const [stretch] = suggestPrimeCoat(map, [photo('p1', north(10)), photo('p2', north(90))]).stretches;
    expect(primeCoatDraftOf(map, stretch!)).toMatchObject({ workId: null, fromM: 10, toM: 90 });
  });
});

import { describe, expect, it } from 'vitest';
import { workMapOverview, type ClientWorkStreets } from '@constroad/shared/obra';
import { workMapOf, workMapView } from './workMap.js';

/**
 * The client must not read two numbers (José 07/11: one engine in `@constroad/shared/obra`):
 * the same `workStreets` gives Lilachat the percent, the street states and the colors Portal shows.
 */
const line = (fromLng: number, toLng: number) => [{ lat: -12.05, lng: fromLng }, { lat: -12.05, lng: toLng }];
const workStreets: ClientWorkStreets = {
  streets: [
    { _id: 's1', name: 'Av. Los Incas', geometry: line(-77.03, -77.027), lengthM: 326.4 },
    { _id: 's2', name: 'Jr. Los Pinos', geometry: line(-77.02, -77.018), lengthM: 217.6 },
    // Portal counts a street drawn with a single point: its stretches add to the totals.
    { _id: 's3', name: 'Calle Lima', geometry: [{ lat: -12.06, lng: -77.02 }], lengthM: 150 },
  ],
  scopes: [
    { _id: 'a1', streetId: 's1', fromM: 0, toM: 300, partidaIds: ['p-imp'], tagIds: ['t-asf'], stageId: 'e1' },
    { _id: 'a2', streetId: 's2', fromM: 0, toM: 200, partidaIds: ['p-imp', 'p-sar'], tagIds: [], stageId: 'e1' },
    { _id: 'a3', streetId: 's3', fromM: 0, toM: 150, partidaIds: ['p-imp'], tagIds: [], stageId: 'e2' },
  ],
  progress: [
    { streetId: 's1', partidaId: '', tagId: 't-asf', fromM: 0, toM: 100.333, date: '2026-11-04' },
    { streetId: 's1', partidaId: '', tagId: 't-asf', fromM: 0, toM: 60, date: '2026-11-05', rework: true },
    { streetId: 's2', partidaId: 'p-imp', fromM: 0, toM: 200, date: '2026-11-05' },
    { streetId: 's2', partidaId: 'p-sar', fromM: 20, toM: 53.337, date: '2026-11-06' },
    { streetId: 's3', partidaId: 'p-imp', fromM: 0, toM: 75.5, date: '2026-11-06' },
  ],
  tags: [{ _id: 't-asf', name: 'Asfalto', color: '#111827', order: 1 }],
  stages: [{ _id: 'e1', name: 'Etapa 1', order: 1 }, { _id: 'e2', name: 'Etapa 2', order: 2 }],
};
const partidas = [{ _id: 'p-imp', description: 'Imprimación asfáltica' }, { _id: 'p-sar', description: 'Sardineles de concreto' }];

describe('the work map reads like Portal (workMapOverview)', () => {
  it('the same percent, street states and colors', () => {
    // Arrange
    const map = workMapOf({ workStreets, partidas });
    if (!map) throw new Error('expected a map');

    // Act
    const view = workMapView(map);
    const portal = workMapOverview({ workStreets, partidas });

    // Assert
    expect(view.percent).toBe(portal.progressPct);
    expect(view.streets.map((street) => [street.id, street.status, street.done])).toEqual(portal.streets.map((street) => [street.streetId, street.status, street.done]));
    expect(view.streets.map((street) => street.segments.map((segment) => segment.color))).toEqual(portal.streets.map((street) => street.segments.map((segment) => segment.color)));
  });

  it('the same percent up to a day', () => {
    // Arrange
    const map = workMapOf({ workStreets, partidas });
    if (!map) throw new Error('expected a map');

    // Act
    const view = workMapView(map, { untilDay: '2026-11-05' });
    const portal = workMapOverview({ workStreets, partidas, upToDate: '2026-11-05' });

    // Assert
    expect(view.percent).toBe(portal.progressPct);
  });
});

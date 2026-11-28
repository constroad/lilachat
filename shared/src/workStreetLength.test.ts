import { describe, expect, it } from 'vitest';
import { workMapOf, workMapView, type WorkMap } from './workMap.js';
import { avanceTargetOf } from './workAvanceMode.js';
import { recordSummary } from './workProgressRecord.js';
import { layerSummaryOf } from './workLayerSummary.js';

/**
 * Emulator QA 28/11 (Jirón Los Naranjos): the layer's sheet said 239 m, the street card and the forms
 * 373 m. A street's length is ONE number, the stored `lengthM` Portal validates against; the layer's
 * sheet measures the layer's STRETCHES (Portal's own overview does the same), which is the other figure.
 */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.996 }];
const naranjos = (): WorkMap => {
  const map = workMapOf({
    workStreets: {
      streets: [{ _id: 'n1', name: 'Jirón Los Naranjos', geometry: line, lengthM: 373 }],
      scopes: [{ _id: 'c1', streetId: 'n1', fromM: 0, toM: 239, tagIds: ['imp'], partidaIds: [] }],
      progress: [],
      tags: [{ _id: 'imp', name: 'Imprimación', color: '#d97706', order: 1 }],
      stages: [],
    },
  });
  if (!map) throw new Error('expected a map');
  return map;
};

describe('one street length', () => {
  it('the card, «Modo Avance» and «Registrar avance» read the stored lengthM, never the drawn line', () => {
    // Arrange
    const map = naranjos();
    // Act
    const card = workMapView(map).streets[0];
    const target = avanceTargetOf(map, 'n1', 'imp');
    const record = recordSummary({ fromM: 0, toM: 0 }, map.streets[0]!.lengthM);
    // Assert
    expect(card?.lengthM).toBe(373);
    expect(target?.lengthM).toBe(373);
    expect(record.total).toBe('Total calle: 373 m');
  });

  it('a stretch far short of its street (0+239 of 373 m) keeps its own length, as Portal measures it', () => {
    const summary = layerSummaryOf(naranjos(), 'imp', null);
    expect(summary?.streets[0]?.totalQty).toBe(239);
  });
});

/**
 * Emulator QA of OTA c327bc0f (Av. El Sol): the form said «Total calle: 276 m», the sheet
 * «55 de 260 m · 21 %». A stretch that nearly reaches its street's end (10 m, or a tenth of the street)
 * is measured up to the street's `lengthM`; one planned short on purpose keeps its own length.
 */
const elSol = (scopes: Array<{ _id: string; fromM: number; toM: number }>): WorkMap => {
  const map = workMapOf({
    workStreets: {
      streets: [{ _id: 'sol', name: 'Av. El Sol', geometry: line, lengthM: 276 }],
      scopes: scopes.map((scope) => ({ ...scope, streetId: 'sol', tagIds: ['imp'], partidaIds: [] })),
      progress: [{ streetId: 'sol', tagId: 'imp', fromM: 0, toM: 55, date: '2026-11-28' }],
      tags: [{ _id: 'imp', name: 'Imprimación', color: '#d97706', order: 1 }],
      stages: [],
    },
  });
  if (!map) throw new Error('expected a map');
  return map;
};

describe('a stretch short of its street (Av. El Sol, 276 m)', () => {
  it('0+000 → 0+260 reads 55 of 276 m and 20 %, as the form', () => {
    // Arrange
    const map = elSol([{ _id: 'c1', fromM: 0, toM: 260 }]);
    // Act
    const row = layerSummaryOf(map, 'imp', null)?.streets[0];
    // Assert
    expect(row).toMatchObject({ totalQty: 276, percent: 20, amount: '55 de 276 m' });
    expect(recordSummary({ fromM: 0, toM: 55 }, map.streets[0]!.lengthM).total).toBe('Total calle: 276 m');
  });

  it('of two stretches, only the one nearly at the end runs to it', () => {
    const map = elSol([{ _id: 'c1', fromM: 0, toM: 100 }, { _id: 'c2', fromM: 150, toM: 270 }]);
    expect(layerSummaryOf(map, 'imp', null)?.streets[0]?.totalQty).toBe(226);
  });

  it('a stretch planned short (0+000 → 0+200 of 276 m) keeps its own length', () => {
    const map = elSol([{ _id: 'c1', fromM: 0, toM: 200 }]);
    expect(layerSummaryOf(map, 'imp', null)?.streets[0]?.totalQty).toBe(200);
  });

  it('a stretch already at or past the end is not touched', () => {
    const map = elSol([{ _id: 'c1', fromM: 0, toM: 276 }]);
    expect(layerSummaryOf(map, 'imp', null)?.streets[0]?.totalQty).toBe(276);
  });

  it('the map\'s work percent keeps Portal\'s stretches (workMapPortalParity)', () => {
    expect(workMapView(elSol([{ _id: 'c1', fromM: 0, toM: 260 }])).percent).toBe(21.2);
  });
});

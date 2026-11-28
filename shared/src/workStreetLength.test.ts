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

  it('the layer sheet measures the layer stretch (0+000 to 0+239), as Portal does', () => {
    const summary = layerSummaryOf(naranjos(), 'imp', null);
    expect(summary?.streets[0]?.totalQty).toBe(239);
  });
});

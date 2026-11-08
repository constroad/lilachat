import { describe, expect, it } from 'vitest';
import { lineLengthM, workMapOf, type WorkMap } from './workMap.js';
import { partialProgressOf, partialStreetsLabel } from './workMapPartial.js';

/** Design o-08: «estas calles en base, estas imprimadas, estas asfaltadas», as the client sees it. */
const lineA = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const lineB = [{ lat: -12.001, lng: -77 }, { lat: -12.001, lng: -76.998 }];
const lineC = [{ lat: -12.002, lng: -77 }, { lat: -12.002, lng: -76.998 }];
const [A, B] = [Math.round(lineLengthM(lineA)), Math.round(lineLengthM(lineB))];

const mapOf = (): WorkMap => {
  const map = workMapOf({
    workStreets: {
      streets: [
        { _id: 'a', name: 'Av. Los Incas', geometry: lineA, lengthM: A },
        { _id: 'b', name: 'Jr. Los Pinos', geometry: lineB, lengthM: B },
        { _id: 'c', name: 'Jr. Las Flores', geometry: lineC, lengthM: 200 },
      ],
      scopes: [
        { _id: 's1', streetId: 'a', fromM: 0, toM: A, tagIds: ['base', 'asfalto'], partidaIds: [], stageId: 'e1' },
        { _id: 's2', streetId: 'b', fromM: 0, toM: B, tagIds: ['base'], partidaIds: [], stageId: 'e1' },
        { _id: 's3', streetId: 'c', fromM: 0, toM: 200, tagIds: ['base'], partidaIds: [], stageId: 'e2' },
      ],
      progress: [
        { streetId: 'a', tagId: 'base', fromM: 0, toM: 200, date: '2026-11-01' },
        { streetId: 'a', tagId: 'base', fromM: 200, toM: A, date: '2026-11-03' },
        { streetId: 'a', tagId: 'asfalto', fromM: 0, toM: 120, date: '2026-11-05' },
        { streetId: 'b', tagId: 'base', fromM: 40, toM: 90, date: '2026-11-02' },
        { streetId: 'c', tagId: 'base', fromM: 0, toM: 200, date: '2026-11-02' },
      ],
      tags: [{ _id: 'base', name: 'Base', color: '#d97706', order: 1 }, { _id: 'asfalto', name: 'Asfalto', color: '#111827', order: 2 }],
      stages: [{ _id: 'e1', name: 'Etapa 1', order: 1 }, { _id: 'e2', name: 'Etapa 2', order: 2 }],
    },
  });
  if (!map) throw new Error('expected a map');
  return map;
};

describe('partialProgressOf', () => {
  it('says, last work first, which streets each work covered: whole, up to a station, or a stretch', () => {
    // Act
    const summary = partialProgressOf(mapOf(), { stageId: 'e1' });
    // Assert
    expect(summary.rows).toEqual([
      { workId: 'asfalto', name: 'Asfalto', color: '#111827', streets: 'Av. Los Incas hasta 0+120' },
      { workId: 'base', name: 'Base', color: '#d97706', streets: 'Av. Los Incas · Jr. Los Pinos 0+040 a 0+090' },
    ]);
    expect(partialStreetsLabel(summary)).toBe('2 de 2 vías');
  });

  it('cuts at the day: what came later is not counted', () => {
    const summary = partialProgressOf(mapOf(), { stageId: 'e1', untilDay: '2026-11-02' });
    expect(summary.rows.map((row) => row.workId)).toEqual(['base']);
    expect(summary.rows[0]!.streets).toBe('Av. Los Incas hasta 0+200 · Jr. Los Pinos 0+040 a 0+090');
  });

  it('without a stage counts every street, and a street with nothing done is not listed', () => {
    const summary = partialProgressOf(mapOf(), {});
    expect(summary.streetsTotal).toBe(3);
    expect(summary.streetsWithProgress).toBe(3);
    expect(summary.doneLabel).toMatch(/^\+[\d ]+ m lineales$/);
    const empty = partialProgressOf({ ...mapOf(), progress: [] }, {});
    expect(empty.rows).toEqual([]);
    expect(partialStreetsLabel({ streetsWithProgress: 0, streetsTotal: 1 })).toBe('0 de 1 vía');
  });
});

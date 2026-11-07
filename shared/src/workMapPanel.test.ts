import { describe, expect, it } from 'vitest';
import { workMapView, type WorkMap } from './workMap.js';
import { stageStateLabel, workMapCutChip, workMapStageGroups, workShares } from './workMapPanel.js';

/** The right panel of design o-01: the bar by work and the streets by stage. */
const LINE = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.99 }];
const map = (): WorkMap => ({
  streets: [
    { id: 's1', name: 'Av. Los Incas', line: LINE, lengthM: 800 },
    { id: 's2', name: 'Jr. Los Pinos', line: LINE, lengthM: 300 },
    { id: 's3', name: 'Calle Lima', line: LINE, lengthM: 200 },
  ],
  scopes: [
    { streetId: 's1', fromM: 0, toM: 800, workIds: ['base', 'asfalto'], stageId: 'e1' },
    { streetId: 's2', fromM: 0, toM: 300, workIds: ['base'], stageId: 'e1' },
    { streetId: 's3', fromM: 0, toM: 200, workIds: ['base'], stageId: 'e2' },
  ],
  progress: [
    { streetId: 's1', workId: 'base', fromM: 0, toM: 400, date: '2026-11-04', rework: false },
    { streetId: 's1', workId: 'asfalto', fromM: 0, toM: 200, date: '2026-11-05', rework: false },
  ],
  works: [{ id: 'base', name: 'Base', color: '#b45309' }, { id: 'asfalto', name: 'Asfaltado', color: '#111827' }],
  stages: [{ id: 'e1', name: 'Etapa 1' }, { id: 'e2', name: 'Etapa 2' }],
});

describe('workShares (the stacked bar under the big figure)', () => {
  it('gives each work its share of the planned length, in the order of the works', () => {
    // 2 100 m planned (800 × 2 works + 300 + 200): base did 400, asphalt 200.
    expect(workShares(workMapView(map()))).toEqual([
      { workId: 'base', color: '#b45309', percent: 19 },
      { workId: 'asfalto', color: '#111827', percent: 9.5 },
    ]);
  });

  it('nothing done is no segment', () => {
    expect(workShares(workMapView({ ...map(), progress: [] }))).toEqual([]);
  });
});

describe('workMapStageGroups (streets grouped by stage)', () => {
  it('groups each street under its stage, with the length of the stage', () => {
    const groups = workMapStageGroups(map(), workMapView(map()));
    expect(groups.map((group) => [group.name, group.lengthM, group.streets.map((street) => street.id)])).toEqual([
      ['Etapa 1', 1100, ['s1', 's2']],
      ['Etapa 2', 200, ['s3']],
    ]);
  });

  it('a work without stages is one group without a title', () => {
    const bare = { ...map(), stages: [], scopes: map().scopes.map(({ stageId: _stage, ...scope }) => scope) };
    expect(workMapStageGroups(bare, workMapView(bare)).map((group) => [group.name, group.streets.length])).toEqual([[null, 3]]);
  });
});

describe('workMapCutChip', () => {
  it('says the day the map is cut at', () => {
    expect(workMapCutChip({})).toBe('Hasta hoy');
    expect(workMapCutChip({ untilDay: '2026-11-05' })).toBe('Hasta el 5 nov');
  });
});

describe('stageStateLabel (the title of each group of streets)', () => {
  it('says a stage with some progress is being built, and one without any is waiting', () => {
    // Arrange
    const [first, second] = workMapStageGroups(map(), workMapView(map()));

    // Act and assert
    expect(first && stageStateLabel(first)).toBe('En ejecución');
    expect(second && stageStateLabel(second)).toBe('Por iniciar');
  });

  it('says a stage whose streets are all finished is done', () => {
    // Arrange
    const finished: WorkMap = { ...map(), progress: [{ streetId: 's3', workId: 'base', fromM: 0, toM: 200, date: '2026-11-05', rework: false }] };

    // Act
    const groups = workMapStageGroups(finished, workMapView(finished));

    // Assert
    expect(groups[1] && stageStateLabel(groups[1])).toBe('Terminada');
  });
});

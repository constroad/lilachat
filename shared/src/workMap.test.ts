import { describe, expect, it } from 'vitest';
import { lineLengthM, loadWorkMap, metersLabel, percentLabel, projectOntoLine, sliceLine, stationLabel, WORK_MAP_FAILED, workMapCollection, workMapHeadline, workMapOf, workMapRequest, workMapStageFilter, workMapView, type WorkMap } from './workMap.js';

const lineOf = (points: Array<[number, number]>) => points.map(([lat, lng]) => ({ lat, lng }));
const LONG_STREET = lineOf([[-12, -77], [-12, -76.99]]);
const LENGTH = lineLengthM(LONG_STREET);

const payload = () => ({
  partidas: [{ _id: 'p1', description: 'Bacheo' }],
  workStreets: {
    streets: [
      { _id: 's1', name: 'Av. Los Olivos', geometry: LONG_STREET, lengthM: LENGTH, widthM: 6 },
      { _id: 's2', name: 'Jr. Las Dalias', geometry: lineOf([[-12.01, -77], [-12.01, -76.999]]), lengthM: 108 },
    ],
    scopes: [
      { _id: 'c1', streetId: 's1', fromM: 0, toM: 400, partidaIds: [], tagIds: ['base', 'asfalto'], stageId: 'e1' },
      { _id: 'c2', streetId: 's1', fromM: 400, toM: 800, partidaIds: [], tagIds: ['base'], stageId: 'e2' },
      { _id: 'c3', streetId: 's2', fromM: 0, toM: 100, partidaIds: ['p1'], tagIds: [] },
    ],
    progress: [
      { streetId: 's1', partidaId: '', tagId: 'base', fromM: 0, toM: 200, date: '2026-11-01' },
      { streetId: 's1', partidaId: '', tagId: 'base', fromM: 100, toM: 300, date: '2026-11-02' },
      { streetId: 's1', partidaId: '', tagId: 'base', fromM: 0, toM: 400, date: '2026-11-03', rework: true },
      { streetId: 's1', partidaId: '', tagId: 'asfalto', fromM: 0, toM: 400, date: '2026-11-04' },
      { streetId: 's2', partidaId: 'p1', fromM: 0, toM: 100, date: '2026-11-04' },
    ],
    tags: [
      { _id: 'asfalto', name: 'Asfaltado', color: '#111111', order: 2 },
      { _id: 'base', name: 'Base', color: '#c08a1e', order: 1 },
    ],
    stages: [
      { _id: 'e2', name: 'Etapa 2', order: 2 },
      { _id: 'e1', name: 'Etapa 1', order: 1 },
    ],
  },
});

const parsed = (): WorkMap => {
  const map = workMapOf(payload());
  if (!map) throw new Error('expected a map');
  return map;
};

describe('workMapOf', () => {
  it('keeps only what the map draws, with works and stages in their order', () => {
    const map = parsed();
    expect(map.works.map((work) => work.name)).toEqual(['Base', 'Asfaltado', 'Bacheo']);
    expect(map.stages.map((stage) => stage.id)).toEqual(['e1', 'e2']);
    expect(map.scopes[0]).toEqual({ streetId: 's1', fromM: 0, toM: 400, workIds: ['base', 'asfalto'], stageId: 'e1' });
    expect(JSON.stringify(map)).not.toContain('widthM');
  });

  it('answers null when Portal has no streets or sends something else', () => {
    expect(workMapOf({ workStreets: null })).toBeNull();
    expect(workMapOf({ workStreets: { streets: [] } })).toBeNull();
    expect(workMapOf('nothing')).toBeNull();
    expect(workMapOf(undefined)).toBeNull();
  });

  it('drops a street without a line and a bad coordinate instead of breaking the map', () => {
    const raw = payload();
    raw.workStreets.streets.push({ _id: 's3', name: 'Sin trazo', geometry: lineOf([[-12, -77]]), lengthM: 0 });
    raw.workStreets.streets.push({ _id: 's4', name: 'Rota', geometry: [{ lat: Number.NaN, lng: -77 }, { lat: -12, lng: -77 }], lengthM: 5 });
    expect(workMapOf(raw)?.streets.map((street) => street.id)).toEqual(['s1', 's2']);
  });

  it('names a partida without a name and gives it a color of its own', () => {
    const raw = { ...payload(), partidas: undefined };
    const work = workMapOf(raw)?.works.find((candidate) => candidate.id === 'p1');
    expect(work?.name).toBe('Trabajo');
    expect(work?.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('workMapView', () => {
  it('adds progress like Portal: union of days, without rework, per work and stretch', () => {
    const view = workMapView(parsed());
    expect(view.totalM).toBe(1300);
    expect(view.doneM).toBe(800);
    expect(view.percent).toBe(61.5);
    expect(view.works.map((work) => [work.name, work.percent])).toEqual([['Base', 38], ['Asfaltado', 100], ['Bacheo', 100]]);
  });

  it('narrows the figures, the streets and the lines to one stage', () => {
    const view = workMapView(parsed(), { stageId: 'e2' });
    expect(view.totalM).toBe(400);
    expect(view.percent).toBe(0);
    expect(view.streets.map((street) => street.id)).toEqual(['s1']);
    expect(view.done).toEqual([]);
    expect(view.planned).toHaveLength(1);
  });

  it('with one work in focus it shows only that work', () => {
    const view = workMapView(parsed(), { workId: 'asfalto' });
    expect(view.percent).toBe(100);
    expect(new Set(view.done.map((line) => line.workId))).toEqual(new Set(['asfalto']));
    expect(view.planned).toHaveLength(1);
  });

  it('draws what was done with the color of the work and in lng,lat', () => {
    const line = workMapView(parsed(), { workId: 'base' }).done[0];
    expect(line.color).toBe('#c08a1e');
    expect(line.coordinates[0]).toEqual([-77, -12]);
  });

  it('tells how far each street went', () => {
    const [olivos, dalias] = workMapView(parsed()).streets;
    expect(olivos.status).toBe('Base hasta 0+300 · Asfaltado completa');
    expect(olivos.done).toBe(false);
    expect(dalias.status).toBe('Terminada');
    expect(dalias.done).toBe(true);
    expect(olivos.segments[0]).toMatchObject({ color: '#c08a1e', fromPct: 0 });
  });

  it('a street without stretches stays on the map with no figures', () => {
    const map = parsed();
    const view = workMapView({ ...map, scopes: [], progress: [] });
    expect(view.percent).toBe(0);
    expect(view.planned).toHaveLength(2);
    expect(view.streets[0].status).toBe('Sin avance');
  });

  it('frames all the streets of the view', () => {
    expect(workMapView(parsed()).bounds).toEqual([[-77, -12.01], [-76.99, -12]]);
  });

  it('a progress record outside the stretch is cut to it', () => {
    const map = parsed();
    const view = workMapView({ ...map, progress: [{ streetId: 's1', workId: 'asfalto', fromM: 300, toM: 900, rework: false }] }, { workId: 'asfalto' });
    expect(view.doneM).toBe(100);
  });
});

describe('sliceLine', () => {
  it('cuts between two stations keeping the middle corners', () => {
    const line = lineOf([[0, 0], [0, 0.001], [0, 0.002]]);
    const total = lineLengthM(line);
    const cut = sliceLine(line, total * 0.25, total * 0.75);
    expect(cut).toHaveLength(3);
    expect(cut[1]).toEqual({ lat: 0, lng: 0.001 });
  });

  it('answers nothing for an inverted cut and clamps beyond the end', () => {
    expect(sliceLine(LONG_STREET, 50, 50)).toEqual([]);
    expect(sliceLine(LONG_STREET, 90, 10)).toEqual([]);
    expect(sliceLine(LONG_STREET, 0, LENGTH * 2).at(-1)).toEqual(LONG_STREET[1]);
  });
});

describe('projectOntoLine', () => {
  const corner = lineOf([[-12.05, -77.03], [-12.049, -77.03], [-12.049, -77.029]]);

  it('reads the station of a place beside the second stretch', () => {
    // Arrange
    const firstStretch = lineLengthM(corner.slice(0, 2));
    const beside = { lat: -12.0489, lng: -77.0295 };

    // Act
    const foot = projectOntoLine(corner, beside);

    // Assert
    expect(foot?.measureM).toBeGreaterThan(firstStretch);
    expect(foot?.distanceM).toBeGreaterThan(10);
    expect(foot?.distanceM).toBeLessThan(12);
  });

  it('stops at the end of the street for a place beyond it', () => {
    // Arrange
    const beyond = { lat: -12.049, lng: -77.02 };

    // Act
    const foot = projectOntoLine(corner, beyond);

    // Assert
    expect(foot?.measureM).toBeCloseTo(lineLengthM(corner), 3);
  });

  it('survives a repeated point in the line', () => {
    // Arrange
    const repeated = lineOf([[-12.05, -77.03], [-12.05, -77.03], [-12.049, -77.03]]);

    // Act
    const foot = projectOntoLine(repeated, { lat: -12.0495, lng: -77.03 });

    // Assert
    expect(foot?.distanceM).toBeCloseTo(0, 3);
  });

  it('answers nothing for a line without two points', () => {
    // Act and assert
    expect(projectOntoLine(lineOf([[-12.05, -77.03]]), { lat: -12.05, lng: -77.03 })).toBeNull();
    expect(projectOntoLine([], { lat: -12.05, lng: -77.03 })).toBeNull();
  });
});

describe('stationLabel', () => {
  it('writes a station the way the field does', () => {
    expect(stationLabel(0)).toBe('0+000');
    expect(stationLabel(240.4)).toBe('0+240');
    expect(stationLabel(1420)).toBe('1+420');
    expect(stationLabel(999.6)).toBe('1+000');
  });
});

describe('labels', () => {
  it('writes figures the Peruvian way, without a locale the phone may lack', () => {
    expect(percentLabel(61.5)).toBe('61,5 %');
    expect(percentLabel(100)).toBe('100 %');
    expect(metersLabel(1300.4)).toBe('1 300 m');
    expect(metersLabel(820)).toBe('820 m');
  });
});

describe('workMapHeadline', () => {
  it('reads the figures, and says so when no stretch is defined yet', () => {
    expect(workMapHeadline({ percent: 61.5, doneM: 800, totalM: 1300 })).toBe('61,5 % · 800 m de 1 300 m');
    expect(workMapHeadline({ percent: 0, doneM: 0, totalM: 0 })).toBe('Sin tramos definidos');
  });
});

describe('workMapRequest', () => {
  const token = 'a'.repeat(64);
  const service = '6aedcc3a2f5e395dca260f16';

  it('asks only Portal, with the token of the link and the service', () => {
    expect(workMapRequest(`https://constroad.com/public/test/service-report/${token}`, service)).toBe(`https://constroad.com/api/public/client-portal/services/${service}?token=${token}`);
    expect(workMapRequest(`https://constroad.com/public/test/service-report/${token}/service/${service}?section=map`, service)).toContain(`token=${token}`);
  });

  it('refuses any other host, a lookalike or a bad service id', () => {
    expect(workMapRequest(`https://evil.com/public/test/service-report/${token}`, service)).toBeNull();
    expect(workMapRequest(`https://constroad.com.evil.com/public/test/service-report/${token}`, service)).toBeNull();
    expect(workMapRequest(`http://constroad.com/public/test/service-report/${token}`, service)).toBeNull();
    expect(workMapRequest(`https://constroad.com/public/test/service-report/${token}`, '../../admin')).toBeNull();
    expect(workMapRequest('https://constroad.com/public/test/other/abc', service)).toBeNull();
    expect(workMapRequest('not a link', service)).toBeNull();
  });
});

describe('workMapCollection', () => {
  it('writes each line as a feature with its color', () => {
    const collection = workMapCollection([{ streetId: 's1', color: '#111111', coordinates: [[-77, -12], [-76.9, -12]] }]);
    expect(collection.features[0]?.properties.color).toBe('#111111');
    expect(collection.features[0]?.geometry.type).toBe('LineString');
  });
});

describe('workMapStageFilter', () => {
  it('keeps the work when the stage has it and drops it when it does not', () => {
    expect(workMapStageFilter(parsed(), { workId: 'base' }, 'e2')).toEqual({ stageId: 'e2', workId: 'base' });
    expect(workMapStageFilter(parsed(), { workId: 'asfalto' }, 'e2')).toEqual({ stageId: 'e2' });
  });

  it('an empty stage is the whole work', () => {
    expect(workMapStageFilter(parsed(), { stageId: 'e2', workId: 'base' }, '')).toEqual({ workId: 'base' });
  });
});

describe('loadWorkMap', () => {
  const url = 'https://constroad.com/public/test/service-report/abc';

  it('reads the map with the link', async () => {
    const read = async (asked: string) => ({ ok: true as const, data: { map: asked === url ? parsed() : null } });
    const state = await loadWorkMap(async () => ({ ok: true, url }), read);
    expect(state.kind === 'ready' && state.map?.streets).toHaveLength(2);
  });

  it('a link that fails never reaches the server', async () => {
    let asked = false;
    const state = await loadWorkMap(async () => ({ ok: false, message: 'Sin enlace' }), async () => {
      asked = true;
      return { ok: false };
    });
    expect(state).toEqual({ kind: 'failed', message: 'Sin enlace' });
    expect(asked).toBe(false);
  });

  it('a server that fails keeps the link, so Portal stays one tap away', async () => {
    const state = await loadWorkMap(async () => ({ ok: true, url }), async () => ({ ok: false }));
    expect(state).toEqual({ kind: 'failed', message: WORK_MAP_FAILED, url });
  });

  it('an answer without a map reads as a service without streets', async () => {
    const state = await loadWorkMap(async () => ({ ok: true, url }), async () => ({ ok: true, data: {} }));
    expect(state).toEqual({ kind: 'ready', url, map: null });
  });
});

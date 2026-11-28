import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkMap } from './workMap.js';
import type { WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';
import { createMapWaiter, foldLayerName, LAYER_CATALOG, LAYER_EXISTS, LAYER_NOT_FOUND, LAYER_PICK_ONE, layerButtonLabel, layerChoicesOf, layerMetradoOf, layerPickIdle, layerStreetRowsOf, layerPlanOf, layerPlanProblem, OTHER_LAYER_COLOR, layerStreetRequests, layerTaken, newWorkIdOf, runLayerCreate, tagIdOfAnswer } from './workLayerCatalog.js';

/** ma03 «Nueva capa» (José 28/11): catalog chips, the metrado and what «Crear capa» sends. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }];
const MAP: WorkMap = {
  streets: [
    { id: 's1', name: 'Jr. Progreso', line, lengthM: 284, widthM: 6 },
    { id: 's2', name: 'Jr. Monje', line, lengthM: 223, widthM: 5.5 },
    { id: 's3', name: 'Pje. San Valentín', line, lengthM: 131 },
  ],
  scopes: [
    { id: 'c1', streetId: 's1', fromM: 0, toM: 150, workIds: ['base'] },
    { id: 'c2', streetId: 's1', fromM: 150, toM: 284, workIds: ['base'], stageId: 'e1' },
  ],
  progress: [],
  works: [{ id: 'base', name: 'IMPRIMACION', color: '#d97706' }, { id: 'p1', name: 'Carpeta Asfáltica 2”', color: '#111827', partida: true }],
  stages: [{ id: 'e1', name: 'Etapa 1' }],
};
const ok = (data?: Record<string, unknown>): WorkProgressResult => ({ ok: true, message: 'Listo', ...(data ? { data } : {}) });
const ids = () => { let count = 0; return () => `entry-${++count}`; };

describe('LAYER_CATALOG', () => {
  it('has the six layers of the design, each with its own color', () => {
    expect(LAYER_CATALOG.map((entry) => entry.name)).toEqual(['Imprimación', 'Riego de liga', 'Carpeta asfáltica 2"', 'Carpeta asfáltica 3"', 'Base granular', 'Sello asfáltico']);
    expect(new Set(LAYER_CATALOG.map((entry) => entry.color)).size).toBe(LAYER_CATALOG.length);
    LAYER_CATALOG.forEach((entry) => expect(entry.color).toMatch(/^#[0-9a-f]{6}$/));
  });
});

describe('foldLayerName / layerTaken / layerChoicesOf', () => {
  it('ignores case, accents, spaces and the quote style', () => {
    expect(foldLayerName('  Carpeta  Asfáltica 2” ')).toBe(foldLayerName('carpeta asfaltica 2"'));
  });
  it('marks the catalog layers the service already has, partidas included', () => {
    const taken = layerChoicesOf(MAP).filter((choice) => choice.taken).map((choice) => choice.key);
    expect(taken).toEqual(['imprimacion', 'carpeta-2']);
  });
  it('marks none on a service without works', () => {
    expect(layerChoicesOf({ works: [] }).some((choice) => choice.taken)).toBe(false);
  });
  it('tells a free custom name from a taken one', () => {
    expect(layerTaken(MAP, 'imprimación')).toBe(true);
    expect(layerTaken(MAP, 'Bacheo')).toBe(false);
  });
});

describe('layerMetradoOf', () => {
  it('adds length and length × width, and says how many streets have no width', () => {
    const metrado = layerMetradoOf(MAP);
    expect(metrado).toMatchObject({ streets: 3, lengthM: 638, areaM2: 2931, missingWidth: 1 });
    expect(metrado.line).toBe('3 calles · 638 m · 2\u202F931 m² · sin ancho en 1 calle');
  });
  it('leaves m² out when no street has width', () => {
    expect(layerMetradoOf({ streets: [{ id: 'a', name: 'A', line, lengthM: 100 }, { id: 'b', name: 'B', line, lengthM: 50 }] }).line).toBe('2 calles · 150 m · sin ancho en 2 calles');
  });
  it('says one street in singular and zero for a map without streets', () => {
    expect(layerMetradoOf({ streets: [MAP.streets[0]] }).line).toBe('1 calle · 284 m · 1\u202F704 m²');
    expect(layerMetradoOf({ streets: [] }).line).toBe('0 calles · 0 m');
  });
});

describe('layerPlanProblem / layerButtonLabel', () => {
  it('asks to pick one, a name, and refuses a layer already there', () => {
    expect(layerPlanProblem(MAP, null)).toBe(LAYER_PICK_ONE);
    expect(layerPlanProblem(MAP, { name: '  ', color: '#000000', allStreets: true })).toBe('Ponle nombre.');
    expect(layerPlanProblem(MAP, { name: 'Imprimación', color: '#000000', allStreets: true })).toBe(LAYER_EXISTS);
    expect(layerPlanProblem(MAP, { name: 'Riego de liga', color: '#000000', allStreets: true })).toBeNull();
  });
  it('names the layer on the button', () => {
    expect(layerButtonLabel(null, false)).toBe('Crear trabajo');
    expect(layerButtonLabel({ name: ' Base granular ', color: '#000000', allStreets: true }, false)).toBe('Crear trabajo Base granular');
    expect(layerButtonLabel({ name: 'X', color: '#000000', allStreets: true }, true)).toBe('Creando…');
  });
});

describe('layerStreetRequests', () => {
  it('adds the layer to every stretch of a street and covers a bare street whole, in map order', () => {
    const requests = layerStreetRequests(MAP, 'new', ids());
    expect(requests.map((request) => [request.street_id, request.scope_id ?? null, request.from_m, request.to_m, request.tag_ids])).toEqual([
      ['s1', 'c1', 0, 150, ['base', 'new']],
      ['s1', 'c2', 150, 284, ['base', 'new']],
      ['s2', null, 0, 223, ['new']],
      ['s3', null, 0, 131, ['new']],
    ]);
    expect(requests[1].stage_id).toBe('e1');
    expect(requests[2].entry_id).not.toBe(requests[3].entry_id);
  });
  it('sends nothing for a map without streets', () => {
    expect(layerStreetRequests({ ...MAP, streets: [], scopes: [] }, 'new', ids())).toEqual([]);
  });
});

describe('tagIdOfAnswer / newWorkIdOf', () => {
  it('reads the id in the shapes the tool may answer', () => {
    expect(tagIdOfAnswer(undefined)).toBeNull();
    expect(tagIdOfAnswer({ tag_id: 't1' })).toBe('t1');
    expect(tagIdOfAnswer({ tag: { _id: 't2' } })).toBe('t2');
    expect(tagIdOfAnswer({ id: '' })).toBeNull();
  });
  it('finds the work the reload added under that name, never one that was there', () => {
    const after = { works: [...MAP.works, { id: 'n1', name: 'riego de liga', color: '#0f766e' }] };
    expect(newWorkIdOf(MAP, after, 'Riego de liga')).toBe('n1');
    expect(newWorkIdOf(MAP, MAP, 'Imprimación')).toBeNull();
  });
});

describe('runLayerCreate', () => {
  const sendWith = (answers: WorkProgressResult[]) => {
    const sent: string[] = [];
    const send = vi.fn<MapEditSend>(async (request) => { sent.push(request.kind); return answers.shift() ?? ok(); });
    return { send, sent };
  };
  const never = async () => null;

  it('refuses before sending when the layer is already there', async () => {
    const { send } = sendWith([]);
    const done = await runLayerCreate(MAP, { name: 'imprimacion', color: '#d97706', allStreets: true }, { send, newEntryId: ids(), findInMap: never });
    expect(done).toEqual({ failure: LAYER_EXISTS, workId: null, paint: false });
    expect(send).not.toHaveBeenCalled();
  });
  it('creates the tag and puts it on every street, one request each', async () => {
    const { send, sent } = sendWith([ok({ tag_id: 'n1' })]);
    const done = await runLayerCreate(MAP, { name: 'Riego de liga', color: '#0f766e', allStreets: true }, { send, newEntryId: ids(), findInMap: never });
    expect(done).toEqual({ failure: null, workId: 'n1', paint: false });
    expect(sent).toEqual(['work_tag', 'work_scope', 'work_scope', 'work_scope', 'work_scope']);
    expect(send.mock.calls[0][0]).toMatchObject({ name: 'Riego de liga', color: '#0f766e' });
  });
  it('stops at the first refused street and shows its refusal', async () => {
    const { send, sent } = sendWith([ok({ tag_id: 'n1' }), ok(), { ok: false, message: 'Sin permiso.' }]);
    const done = await runLayerCreate(MAP, { name: 'Riego de liga', color: '#0f766e', allStreets: true }, { send, newEntryId: ids(), findInMap: never });
    expect(done).toEqual({ failure: 'Sin permiso.', workId: 'n1', paint: false });
    expect(sent).toHaveLength(3);
  });
  it('with the switch off only creates the layer and asks for the brush', async () => {
    const { send, sent } = sendWith([ok()]);
    const findInMap = vi.fn(async (pick: (map: WorkMap) => string | null) => pick({ ...MAP, works: [...MAP.works, { id: 'n2', name: 'Bacheo', color: '#dc2626' }] }));
    const done = await runLayerCreate(MAP, { name: 'Bacheo', color: '#dc2626', allStreets: false }, { send, newEntryId: ids(), findInMap });
    expect(done).toEqual({ failure: null, workId: 'n2', paint: true });
    expect(sent).toEqual(['work_tag']);
  });
  it('says so when the tag was refused or the map never showed it', async () => {
    const refused = sendWith([{ ok: false, message: 'No se pudo crear el trabajo.' }]);
    expect(await runLayerCreate(MAP, { name: 'Bacheo', color: '#dc2626', allStreets: true }, { send: refused.send, newEntryId: ids(), findInMap: never })).toEqual({ failure: 'No se pudo crear el trabajo.', workId: null, paint: false });
    const lost = sendWith([ok()]);
    expect(await runLayerCreate(MAP, { name: 'Bacheo', color: '#dc2626', allStreets: true }, { send: lost.send, newEntryId: ids(), findInMap: never })).toEqual({ failure: LAYER_NOT_FOUND, workId: null, paint: false });
  });
});

describe('createMapWaiter', () => {
  afterEach(() => vi.useRealTimers());
  const withWork = (id: string): WorkMap => ({ ...MAP, works: [{ id, name: id, color: '#000000' }] });
  const pickNew = (map: WorkMap) => map.works.find((work) => work.id === 'n1')?.id ?? null;

  it('answers at once from the latest map', async () => {
    const waiter = createMapWaiter(1000);
    waiter.offer(withWork('n1'));
    expect(await waiter.find(pickNew)).toBe('n1');
  });
  it('waits for a later map that has it, skipping the ones that do not', async () => {
    const waiter = createMapWaiter(1000);
    waiter.offer(MAP);
    const found = waiter.find(pickNew);
    waiter.offer(withWork('other'));
    waiter.offer(withWork('n1'));
    expect(await found).toBe('n1');
  });
  it('gives up with null after the wait', async () => {
    vi.useFakeTimers();
    const waiter = createMapWaiter(1000);
    const found = waiter.find(pickNew);
    vi.advanceTimersByTime(1000);
    expect(await found).toBeNull();
  });
});

describe('layerPlanOf', () => {
  it('is null until a chip is picked, and the switch starts on', () => {
    expect(layerPickIdle()).toEqual({ key: null, otherName: '', otherColor: OTHER_LAYER_COLOR, allStreets: true });
    expect(layerPlanOf(layerPickIdle())).toBeNull();
    expect(layerPlanOf({ ...layerPickIdle(), key: 'unknown' })).toBeNull();
  });
  it('takes the catalog name and color, or the typed ones for «Otra…»', () => {
    expect(layerPlanOf({ ...layerPickIdle(), key: 'riego-liga', allStreets: false })).toEqual({ name: 'Riego de liga', color: '#0f766e', allStreets: false });
    expect(layerPlanOf({ key: 'otra', otherName: 'Bacheo', otherColor: '#123456', allStreets: true })).toEqual({ name: 'Bacheo', color: '#123456', allStreets: true });
  });
});

describe('layerStreetRowsOf', () => {
  it('gives each street its length, width and m², or says it has no width', () => {
    expect(layerStreetRowsOf(MAP)).toEqual([
      { id: 's1', name: 'Jr. Progreso', detail: '284 m · ancho 6 m', area: '1\u202F704 m²' },
      { id: 's2', name: 'Jr. Monje', detail: '223 m · ancho 5,5 m', area: '1\u202F227 m²' },
      { id: 's3', name: 'Pje. San Valentín', detail: '131 m · sin ancho', area: null },
    ]);
  });
});

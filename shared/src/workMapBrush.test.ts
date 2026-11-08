import { describe, expect, it } from 'vitest';
import type { WorkMap } from './workMap.js';
import { BRUSH_LAST_WORK, brushProblem, paintAt, undoStroke, BRUSH_REACH_M, BRUSH_STAGE_COLOR, brushHas, brushLinesOf, brushTitle, runBrushRequests, streetAtTap, brushRequests, brushUndoRequests, stageCardsOf, workRowsOf, type Brush } from './workMapBrush.js';

/** o-04 «Etapas» and o-05 «Trabajos» (audit 08/11 item 2): the cards and the brush that paints streets. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }];
const MAP: WorkMap = {
  streets: [
    { id: 's1', name: 'Av. Los Incas', line, lengthM: 200, widthM: 6 },
    { id: 's2', name: 'Jr. Los Pinos', line, lengthM: 100, widthM: 5 },
    { id: 's3', name: 'Calle Tacna', line, lengthM: 80 },
  ],
  scopes: [
    { id: 'c1', streetId: 's1', fromM: 0, toM: 200, workIds: ['base', 'asf'], stageId: 'e1' },
    { id: 'c2', streetId: 's2', fromM: 0, toM: 100, workIds: ['base'], stageId: 'e1', widthM: 4 },
  ],
  progress: [
    { streetId: 's1', workId: 'base', fromM: 0, toM: 200, date: '2026-11-12', rework: false },
    { streetId: 's1', workId: 'asf', fromM: 0, toM: 100, date: '2026-11-14', rework: false },
  ],
  works: [{ id: 'base', name: 'Base', color: '#d97706' }, { id: 'asf', name: 'Asfalto', color: '#111827', partida: true }],
  stages: [{ id: 'e1', name: 'Etapa 1' }, { id: 'e2', name: 'Etapa 2' }],
};

describe('stageCardsOf', () => {
  it('sums streets, metres and m² of each stage, its percent and the days its work was approved', () => {
    const { cards } = stageCardsOf(MAP);
    expect(cards[0]).toMatchObject({ id: 'e1', name: 'Etapa 1', streets: [{ id: 's1', name: 'Av. Los Incas', lengthM: 200 }, { id: 's2', name: 'Jr. Los Pinos', lengthM: 100 }], lengthM: 300, areaM2: 1600, line: '2 calles · 300 m · 1 600 m²', days: 'Jornadas del 12 nov al 14 nov' });
    expect(cards[0].percent).toBe(60);
  });

  it('a stage without streets or work says so', () => {
    expect(stageCardsOf(MAP).cards[1]).toMatchObject({ id: 'e2', streets: [], lengthM: 0, percent: 0, line: '0 calles · 0 m · 0 m²', days: 'Sin jornadas todavía' });
  });

  it('lists the streets without a stage apart', () => {
    expect(stageCardsOf(MAP).loose).toEqual([{ id: 's3', name: 'Calle Tacna', lengthM: 80 }]);
  });

  it('one day of work reads in the singular', () => {
    const single = { ...MAP, progress: [MAP.progress[0]] };
    expect(stageCardsOf(single).cards[0].days).toBe('Jornada del 12 nov');
  });
});

describe('workRowsOf', () => {
  it('numbers the works and says on how many streets and metres each one goes', () => {
    expect(workRowsOf(MAP)).toEqual([
      { id: 'base', name: 'Base', color: '#d97706', order: 1, streets: 2, lengthM: 300, line: '2 calles · 300 m', editable: true },
      // A contract item is not renamed nor deleted from the map (Portal c1c35c58).
      { id: 'asf', name: 'Asfalto', color: '#111827', order: 2, streets: 1, lengthM: 200, line: '1 calle · 200 m', editable: false },
    ]);
  });
});

describe('brushRequests: a tap on a street toggles the brush on all its stretches', () => {
  const stage2: Brush = { kind: 'stage', id: 'e2' };
  const asphalt: Brush = { kind: 'work', id: 'asf' };

  it('puts the stage on every stretch of the street, keeping its works and width', () => {
    expect(brushRequests(MAP, stage2, 's2', 'k')).toEqual([{ kind: 'work_scope', street_id: 's2', scope_id: 'c2', from_m: 0, to_m: 100, tag_ids: ['base'], partida_ids: [], stage_id: 'e2', width_m: 4, forms: expect.any(Number) }]);
  });

  it('a street already in the stage leaves it', () => {
    expect(brushRequests(MAP, { kind: 'stage', id: 'e1' }, 's1', 'k')[0]).toMatchObject({ scope_id: 'c1', stage_id: null });
  });

  it('a street without stretches gets one along all of it, with the work painted', () => {
    expect(brushRequests(MAP, { kind: 'work', id: 'base' }, 's3', 'k')).toEqual([{ kind: 'work_scope', street_id: 's3', from_m: 0, to_m: 80, tag_ids: ['base'], partida_ids: [], stage_id: null, entry_id: 'k', forms: expect.any(Number) }]);
  });

  it('adds a work where it is missing; partidas travel apart from tags', () => {
    expect(brushRequests(MAP, asphalt, 's2', 'k')[0]).toMatchObject({ scope_id: 'c2', tag_ids: ['base'], partida_ids: ['asf'], stage_id: 'e1' });
  });

  it('removes a work the street already has everywhere', () => {
    expect(brushRequests(MAP, asphalt, 's1', 'k')[0]).toMatchObject({ scope_id: 'c1', tag_ids: ['base'], partida_ids: [] });
  });

  it('a street that is not on the map asks for nothing', () => {
    expect(brushRequests(MAP, asphalt, 'nope', 'k')).toEqual([]);
  });

  it('brushHas says which streets the brush already covers, to paint them', () => {
    expect(brushHas(MAP, asphalt, 's1')).toBe(true);
    expect(brushHas(MAP, asphalt, 's2')).toBe(false);
    expect(brushHas(MAP, { kind: 'stage', id: 'e1' }, 's3')).toBe(false);
  });
});

describe('brushUndoRequests: «Deshacer» puts the street back as it was', () => {
  it('restores the stretches the street had', () => {
    const after: WorkMap = { ...MAP, scopes: MAP.scopes.map((scope) => (scope.id === 'c2' ? { ...scope, stageId: 'e2' } : scope)) };
    expect(brushUndoRequests(MAP, after, 's2')).toEqual([expect.objectContaining({ scope_id: 'c2', stage_id: 'e1', tag_ids: ['base'] })]);
  });

  it('a stretch the brush created is deleted: Portal refuses one without works', () => {
    const worked: WorkMap = { ...MAP, scopes: [...MAP.scopes, { id: 'c9', streetId: 's3', fromM: 0, toM: 80, workIds: ['base'] }] };
    expect(brushUndoRequests(MAP, worked, 's3')).toEqual([{ kind: 'work_scope_delete', scope_id: 'c9', forms: expect.any(Number) }]);
  });
});

describe('streetAtTap: which street of the work a tap in brush mode means', () => {
  const twoStreets: WorkMap = { ...MAP, streets: [
    { id: 'a', name: 'A', line: [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.998 }], lengthM: 218 },
    { id: 'b', name: 'B', line: [{ lat: -12.001, lng: -77 }, { lat: -12.001, lng: -76.998 }], lengthM: 218 },
  ] };

  it('takes the nearest street within reach', () => {
    expect(streetAtTap(twoStreets, { lat: -12.0001, lng: -76.999 })).toBe('a');
    expect(streetAtTap(twoStreets, { lat: -12.0009, lng: -76.999 })).toBe('b');
  });

  it('a tap far from every street is nothing', () => {
    expect(BRUSH_REACH_M).toBeGreaterThan(0);
    expect(streetAtTap(twoStreets, { lat: -12.01, lng: -76.999 })).toBeNull();
  });
});

describe('brushLinesOf: the streets the brush already covers, painted over the map', () => {
  it('in the work\'s color, or the stage color', () => {
    const lines = brushLinesOf(MAP, { kind: 'work', id: 'asf' });
    expect(lines.map((one) => [one.streetId, one.color])).toEqual([['s1', '#111827']]);
    expect(brushLinesOf(MAP, { kind: 'stage', id: 'e1' }).map((one) => one.color)).toEqual([BRUSH_STAGE_COLOR, BRUSH_STAGE_COLOR]);
  });
});

describe('brushTitle', () => {
  it('names what is being painted, as the design\'s band', () => {
    expect(brushTitle(MAP, { kind: 'work', id: 'base' })).toBe('Pintando Base · Toca las calles que la llevan');
    expect(brushTitle(MAP, { kind: 'stage', id: 'e2' })).toBe('Toca las calles en el mapa para sumarlas a Etapa 2');
  });
});

describe('runBrushRequests', () => {
  const request = brushRequests(MAP, { kind: 'stage', id: 'e2' }, 's2', 'k')[0];

  it('sends each stretch and says nothing when Portal kept them', async () => {
    const sent: unknown[] = [];
    const send = async (one: unknown) => { sent.push(one); return { ok: true as const, message: 'ok' }; };
    expect(await runBrushRequests(send, [request, request])).toBeNull();
    expect(sent).toHaveLength(2);
  });

  it('stops at the first refusal and shows its words', async () => {
    let calls = 0;
    const send = async () => { calls += 1; return { ok: false as const, message: 'Sin permiso.' }; };
    expect(await runBrushRequests(send, [request, request])).toBe('Sin permiso.');
    expect(calls).toBe(1);
  });

  it('a tap off the work explains itself', async () => {
    expect(await runBrushRequests(async () => ({ ok: true as const, message: '' }), [])).toBe('Toca sobre una calle de la obra.');
  });
});

describe('paintAt and undoStroke', () => {
  const ok = async () => ({ ok: true as const, message: 'ok' });

  it('a tap on a street gives the stroke to undo; off the work, the reason and no stroke', async () => {
    const painted = await paintAt(MAP, { kind: 'stage', id: 'e2' }, { lat: -12, lng: -76.9995 }, ok, () => 'k');
    expect(painted.failure).toBeNull();
    expect(painted.stroke?.brush).toEqual({ kind: 'stage', id: 'e2' });
    expect(await paintAt(MAP, { kind: 'stage', id: 'e2' }, { lat: -13, lng: -76 }, ok, () => 'k')).toEqual({ failure: 'Toca sobre una calle de la obra.', stroke: null });
  });

  it('a street without stretches gets a new one keyed by a fresh id: Portal wants a UUID (web E2E 08/11)', async () => {
    const bare: WorkMap = { ...MAP, streets: [MAP.streets[2]!], scopes: [] };
    const sent: unknown[] = [];
    const uuid = '0f8b2c4e-1a2b-4c3d-8e9f-0123456789ab';
    const painted = await paintAt(bare, { kind: 'work', id: 'base' }, { lat: -12, lng: -76.9995 }, async (one) => { sent.push(one); return { ok: true, message: '' }; }, () => uuid);
    expect(painted.failure).toBeNull();
    expect(sent).toEqual([expect.objectContaining({ kind: 'work_scope', street_id: 's3', entry_id: uuid, tag_ids: ['base'] })]);
  });

  it('undoing sends the street back as it was', async () => {
    const sent: unknown[] = [];
    const after: WorkMap = { ...MAP, scopes: MAP.scopes.map((scope) => (scope.id === 'c2' ? { ...scope, stageId: 'e2' } : scope)) };
    expect(await undoStroke({ before: MAP, brush: { kind: 'stage', id: 'e2' }, streetId: 's2' }, after, async (one) => { sent.push(one); return { ok: true, message: '' }; })).toBeNull();
    expect(sent).toEqual([expect.objectContaining({ scope_id: 'c2', stage_id: 'e1' })]);
  });
});

describe('brushProblem: a stretch keeps a work or its stage (Portal 08/11, after the web E2E)', () => {
  const lonely: WorkMap = { ...MAP, scopes: [{ id: 'c1', streetId: 's1', fromM: 0, toM: 200, workIds: ['base'] }] };

  it('the last work of a stretch without a stage stays: Portal refuses an empty one', () => {
    expect(brushProblem(lonely, { kind: 'work', id: 'base' }, 's1')).toBe(BRUSH_LAST_WORK);
    expect(brushRequests(lonely, { kind: 'work', id: 'base' }, 's1', 'k')).toEqual([]);
  });

  it('with a stage, the last work can go: the stage holds the stretch', () => {
    const staged: WorkMap = { ...MAP, scopes: [{ ...lonely.scopes[0], stageId: 'e1' }] };
    expect(brushProblem(staged, { kind: 'work', id: 'base' }, 's1')).toBeNull();
  });

  it('a stretch with only its stage keeps it', () => {
    const onlyStage: WorkMap = { ...MAP, scopes: [{ id: 'c5', streetId: 's3', fromM: 0, toM: 80, workIds: [], stageId: 'e2' }] };
    expect(brushProblem(onlyStage, { kind: 'stage', id: 'e2' }, 's3')).toBe(BRUSH_LAST_WORK);
  });

  it('a street without works joins a stage with a stretch of only the stage', () => {
    expect(brushProblem(MAP, { kind: 'stage', id: 'e2' }, 's3')).toBeNull();
    expect(brushRequests(MAP, { kind: 'stage', id: 'e2' }, 's3', 'k')).toEqual([expect.objectContaining({ street_id: 's3', tag_ids: [], partida_ids: [], stage_id: 'e2', from_m: 0, to_m: 80 })]);
  });

  it('paintAt shows the problem and sends nothing', async () => {
    let calls = 0;
    const result = await paintAt(lonely, { kind: 'work', id: 'base' }, { lat: -12, lng: -76.9995 }, async () => { calls += 1; return { ok: true, message: '' }; }, () => 'k');
    expect(result).toEqual({ failure: BRUSH_LAST_WORK, stroke: null });
    expect(calls).toBe(0);
  });
});

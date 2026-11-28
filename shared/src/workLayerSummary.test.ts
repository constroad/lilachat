import { describe, expect, it } from 'vitest';
import { workMapView, type WorkMap } from './workMap.js';
import { avanceChipsOf } from './workAvanceMode.js';
import { layerRowsOf } from './workMapLayers.js';
import { layerPercentOf, layerScopeOf } from './workLayerPercent.js';
import type { ByApproveList, ByApproveProgress } from './workByApprove.js';
import { activeLayerOf, LAYER_PENDING_PILL, layerBarOf, layerChipsOf, layerDraftFor, layerLatestOf, layerRecordMap, layerSummaryOf, layerWidthNote } from './workLayerSummary.js';

/** Design ma01 (José 28/11): the sheet of the active layer, in m² when every street has a width. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }];
const MAP: WorkMap = {
  streets: [
    { id: 'pro', name: 'Jr. Progreso', line, lengthM: 284, widthM: 6 },
    { id: 'des', name: 'Av. El Descanso', line, lengthM: 410, widthM: 7 },
    { id: 'mon', name: 'Jr. Monje', line, lengthM: 223, widthM: 5.5 },
  ],
  scopes: [
    { id: 'c1', streetId: 'pro', fromM: 0, toM: 284, workIds: ['imp', 'car'] },
    { id: 'c2', streetId: 'des', fromM: 0, toM: 410, workIds: ['imp'] },
    { id: 'c3', streetId: 'mon', fromM: 0, toM: 223, workIds: ['imp'] },
  ],
  progress: [
    { streetId: 'pro', workId: 'imp', fromM: 0, toM: 120, date: '2026-11-26', rework: false },
    { streetId: 'des', workId: 'imp', fromM: 0, toM: 410, date: '2026-11-25', rework: false },
    { streetId: 'des', workId: 'imp', fromM: 0, toM: 50, date: '2026-11-27', rework: true },
  ],
  works: [{ id: 'imp', name: 'Imprimación', color: '#d97706' }, { id: 'car', name: 'Carpeta 2"', color: '#2563eb' }, { id: 'rie', name: 'Riego de liga', color: '#0f766e' }],
  stages: [],
};

const pending = (over: Partial<ByApproveProgress>): ByApproveProgress => ({ id: 'p1', state: 'pendiente', date: '2026-11-28', streetId: 'pro', fromM: 120, toM: 166, workId: 'imp', quantity: 46, author: 'Ana', own: true, rejectNote: null, ...over });
const listOf = (...items: ByApproveProgress[]): ByApproveList => ({ total: items.length, items });

describe('layerSummaryOf', () => {
  it('adds the approved area of the layer over its planned area, in m²', () => {
    // Arrange
    const total = 284 * 6 + 410 * 7 + 223 * 5.5;
    // Act
    const summary = layerSummaryOf(MAP, 'imp', null)!;
    // Assert
    expect(summary.unit).toBe('m²');
    expect(summary.doneQty).toBe(120 * 6 + 410 * 7);
    expect(summary.totalQty).toBeCloseTo(total);
    expect(summary.headline).toBe('3 590 de 5 801 m²');
    expect(summary.percent).toBe(62);
    expect(summary.percentText).toBe('62 %');
    expect(summary.kicker).toBe('IMPRIMACIÓN');
    expect(summary.recordLabel).toBe('Registrar avance de Imprimación');
    expect(summary.widthNote).toBeNull();
  });

  it('gives one row per street of the layer with its own bar and percent', () => {
    // Act
    const rows = layerSummaryOf(MAP, 'imp', null)!.streets;
    // Assert
    expect(rows.map((row) => [row.name, row.amount, row.percentText])).toEqual([
      ['Jr. Progreso', '720 de 1 704 m²', '42 %'],
      ['Av. El Descanso', '2 870 de 2 870 m²', '100 %'],
      ['Jr. Monje', '0 de 1 227 m²', '0 %'],
    ]);
  });

  it('leaves rework out of the done figure', () => {
    // Act
    const descanso = layerSummaryOf(MAP, 'imp', null)!.streets.find((row) => row.streetId === 'des')!;
    // Assert
    expect(descanso.doneQty).toBe(410 * 7);
  });

  it('shows what waits apart and never counts it in the percent', () => {
    // Arrange
    const list = listOf(pending({}), pending({ id: 'p0', fromM: 100, toM: 130 }), pending({ id: 'r', state: 'rechazado', fromM: 166, toM: 284 }));
    // Act
    const row = layerSummaryOf(MAP, 'imp', list)!.streets[0]!;
    // Assert
    expect(row.pendingQty).toBe(46 * 6);
    expect(row.percent).toBe(42);
    expect(row.donePct).toBeCloseTo((120 / 284) * 100);
    expect(row.pendingPct).toBeCloseTo((46 / 284) * 100);
  });

  it('ignores what waits for another layer or without a stretch', () => {
    // Arrange
    const list = listOf(pending({ workId: 'car' }), pending({ id: 'x', fromM: null, toM: null }));
    // Act
    const summary = layerSummaryOf(MAP, 'imp', list)!;
    // Assert
    expect(summary.pendingQty).toBe(0);
  });

  it('falls back to metres when a street has no width, and says how many', () => {
    // Arrange
    const map: WorkMap = { ...MAP, streets: MAP.streets.map((street) => (street.id === 'mon' ? { ...street, widthM: undefined } : street)) };
    // Act
    const summary = layerSummaryOf(map, 'imp', null)!;
    // Assert
    expect(summary.unit).toBe('m');
    expect(summary.headline).toBe('530 de 917 m');
    expect(summary.streets[0]!.amount).toBe('120 de 284 m');
    expect(summary.widthNote).toBe(layerWidthNote(1));
    expect(layerWidthNote(2)).toBe('En metros: 2 calles sin ancho');
  });

  it('takes a stretch width over the street width', () => {
    // Arrange
    const map: WorkMap = { ...MAP, scopes: [{ id: 'c1', streetId: 'pro', fromM: 0, toM: 100, workIds: ['imp'], widthM: 8 }] };
    // Act
    const summary = layerSummaryOf(map, 'imp', null)!;
    // Assert
    expect(summary.totalQty).toBe(800);
    expect(summary.doneQty).toBe(800);
  });

  it('counts overlapping stretches once, at the wider width', () => {
    // Arrange
    const map: WorkMap = { ...MAP, scopes: [
      { id: 'a', streetId: 'pro', fromM: 0, toM: 200, workIds: ['imp'], widthM: 6 },
      { id: 'b', streetId: 'pro', fromM: 100, toM: 284, workIds: ['imp'], widthM: 7 },
    ] };
    // Act
    const summary = layerSummaryOf(map, 'imp', null)!;
    // Assert
    expect(summary.totalQty).toBe(100 * 6 + 184 * 7);
    expect(summary.doneQty).toBe(100 * 6 + 20 * 7);
  });

  it('cuts approved progress past the stretch', () => {
    // Arrange
    const map: WorkMap = { ...MAP, scopes: [{ id: 'a', streetId: 'pro', fromM: 50, toM: 100, workIds: ['imp'] }] };
    // Act
    const summary = layerSummaryOf(map, 'imp', null)!;
    // Assert
    expect(summary.streets[0]!.amount).toBe('300 de 300 m²');
  });

  it('says a layer with no streets has none, at zero', () => {
    // Act
    const summary = layerSummaryOf(MAP, 'rie', null)!;
    // Assert
    expect(summary.streets).toEqual([]);
    expect(summary.headline).toBe('Sin calles asignadas');
    expect(summary.percent).toBe(0);
    expect(summary.unit).toBe('m');
    expect(summary.widthNote).toBeNull();
  });

  it('is null for a layer the map does not have', () => {
    expect(layerSummaryOf(MAP, 'nope', null)).toBeNull();
  });

  it('keeps a layer with no progress at 0 % with its planned total', () => {
    // Act
    const summary = layerSummaryOf(MAP, 'car', null)!;
    // Assert
    expect(summary.headline).toBe('0 de 1 704 m²');
    expect(summary.percentText).toBe('0 %');
  });
});

describe('layerBarOf', () => {
  it('puts what waits right after the approved part', () => {
    expect(layerBarOf({ donePct: 40, pendingPct: 15 })).toEqual({ done: '40%', pending: '15%', pendingLeft: '40%' });
  });
});

describe('layerChipsOf', () => {
  it('gives every layer with the same percent its sheet shows, the active one selected', () => {
    // Act
    const chips = layerChipsOf(MAP, 'car');
    // Assert
    expect(chips.map((chip) => [chip.label, chip.selected])).toEqual([['Imprimación 62 %', false], ['Carpeta 2" 0 %', true], ['Riego de liga 0 %', false]]);
  });
});

describe('layerLatestOf', () => {
  it('names the newest progress of the layer, pending first on the same day', () => {
    // Act
    const latest = layerLatestOf(MAP, 'imp', listOf(pending({})), '2026-11-28');
    // Assert
    expect(latest).toEqual({ text: 'Último: hoy · Jr. Progreso +46 m', pill: LAYER_PENDING_PILL });
  });

  it('shows the Lima time when the date carries one', () => {
    // Act
    const latest = layerLatestOf(MAP, 'imp', listOf(pending({ date: '2026-11-28T15:42:00.000Z' })), '2026-11-28');
    // Assert
    expect(latest?.text).toBe('Último: hoy 10:42 · Jr. Progreso +46 m');
  });

  it('reads a time without a zone as written', () => {
    expect(layerLatestOf(MAP, 'imp', listOf(pending({ date: '2026-11-27T08:05' })), '2026-11-28')?.text).toBe('Último: ayer 08:05 · Jr. Progreso +46 m');
  });

  it('falls back to the approved progress, without the pill', () => {
    // Act
    const latest = layerLatestOf(MAP, 'imp', null, '2026-11-28');
    // Assert
    expect(latest).toEqual({ text: 'Último: 26 nov · Jr. Progreso +120 m', pill: null });
  });

  it('leaves the rejected and the rework out', () => {
    // Arrange
    const list = listOf(pending({ state: 'rechazado', date: '2026-11-28' }));
    // Act
    const latest = layerLatestOf(MAP, 'imp', list, '2026-11-28');
    // Assert
    expect(latest?.pill).toBeNull();
    expect(latest?.text).toContain('26 nov');
  });

  it('is null for a layer without progress', () => {
    expect(layerLatestOf(MAP, 'rie', null, '2026-11-28')).toBeNull();
  });

  it('tolerates a pending one without street or stretch', () => {
    expect(layerLatestOf(MAP, 'imp', listOf(pending({ streetId: null, fromM: null, toM: null, quantity: 12 })), '2026-11-28')?.text).toBe('Último: hoy · +12 m');
  });
});

describe('layerRecordMap and layerDraftFor', () => {
  it('limits the GPS and the chooser to the layer streets', () => {
    // Act
    const scoped = layerRecordMap(MAP, 'car');
    // Assert
    expect(scoped.scopes.map((scope) => scope.id)).toEqual(['c1']);
    expect(layerRecordMap(MAP, 'rie')).toBe(MAP);
    expect(layerRecordMap(MAP, null)).toBe(MAP);
  });

  it('opens ma04 with the layer picked from where it stopped', () => {
    // Act
    const opened = layerDraftFor(MAP, 'pro', 'imp');
    // Assert
    expect(opened.draft.workId).toBe('imp');
    expect(opened.draft.fromM).toBe(120);
  });

  it('keeps the usual draft when the street does not carry the layer', () => {
    // Act
    const opened = layerDraftFor(MAP, 'des', 'car');
    // Assert
    expect(opened.draft.workId).toBe('imp');
    expect(layerDraftFor(MAP, 'pro', null).draft.workId).toBeNull();
  });
});

describe('activeLayerOf', () => {
  it('opens on the first layer and follows the one picked', () => {
    // Act
    const first = activeLayerOf(MAP, null, null, '2026-11-28');
    const picked = activeLayerOf(MAP, null, 'car', '2026-11-28');
    // Assert
    expect(first.workId).toBe('imp');
    expect(first.summary?.name).toBe('Imprimación');
    expect(first.latest?.text).toContain('Jr. Progreso');
    expect(picked.chips.find((chip) => chip.selected)?.id).toBe('car');
    expect(picked.latest).toBeNull();
  });

  it('falls back to the first layer when the picked one is gone, and is empty without layers', () => {
    // Act
    const gone = activeLayerOf(MAP, null, 'deleted', '2026-11-28');
    const empty = activeLayerOf({ ...MAP, works: [] }, null, null, '2026-11-28');
    // Assert
    expect(gone.workId).toBe('imp');
    expect(empty).toEqual({ workId: null, chips: [], summary: null, latest: null });
  });
});

describe('one percent per layer (José 28/11)', () => {
  it('ma01 chips and sheet, «Modo Avance» and «Capas y leyenda» show the same % for every layer', () => {
    // Arrange: widths that make the area % differ from the metre %, and something waiting
    const list = listOf(pending({}));
    // Act
    const ma01 = layerChipsOf(MAP, null).map((chip) => chip.percent);
    const sheets = MAP.works.map((work) => layerSummaryOf(MAP, work.id, list)!.percent);
    const avance = avanceChipsOf(MAP, null).map((chip) => chip.percent);
    const capas = layerRowsOf(workMapView(MAP), [], [], MAP).works.map((row) => row.percent);
    // Assert
    expect(ma01).toEqual([62, 0, 0]);
    expect(sheets).toEqual(ma01);
    expect(avance).toEqual(ma01);
    expect(capas).toEqual(ma01);
  });

  it('counts metres when a street of the layer has no width, and never what waits', () => {
    // Arrange
    const map: WorkMap = { ...MAP, streets: MAP.streets.map((street) => (street.id === 'mon' ? { ...street, widthM: undefined } : street)) };
    // Act
    const percent = layerPercentOf(map, 'imp');
    // Assert
    expect(percent).toBe(Math.round((530 / 917) * 100));
    expect(layerSummaryOf(map, 'imp', listOf(pending({})))!.percent).toBe(percent);
  });
});

describe('the board filter (stage and day cut) moves the one percent equally', () => {
  const STAGED: WorkMap = { ...MAP, scopes: MAP.scopes.map((scope) => ({ ...scope, stageId: scope.id === 'c1' ? 'e1' : 'e2' })), stages: [{ id: 'e1', name: 'Etapa 1' }, { id: 'e2', name: 'Etapa 2' }] };
  const threePlaces = (filter: { stageId?: string; untilDay?: string }) => ({
    ma01: layerChipsOf(STAGED, null, filter).map((chip) => chip.percent),
    sheets: STAGED.works.map((work) => layerSummaryOf(STAGED, work.id, null, filter)!.percent),
    avance: avanceChipsOf(STAGED, null, filter).map((chip) => chip.percent),
    capas: layerRowsOf(workMapView(STAGED, filter), [], [], STAGED, filter).works.map((row) => row.percent),
  });

  it('a stage filter changes the % of every layer the same way in the three places', () => {
    // Act
    const whole = threePlaces({});
    const stage = threePlaces({ stageId: 'e1' });
    // Assert: Jr. Progreso alone (stage 1) is 120 of 284 m for Imprimación
    expect(whole.ma01[0]).toBe(62);
    expect(stage.ma01[0]).toBe(42);
    expect(stage.sheets).toEqual(stage.ma01);
    expect(stage.avance).toEqual(stage.ma01);
    expect(stage.capas[0]).toBe(stage.ma01[0]);
    expect(stage.capas[1]).toBe(stage.ma01[1]);
  });

  it('the day cut leaves later progress out, the same way in the three places', () => {
    // Act
    const cut = threePlaces({ untilDay: '2026-11-25' });
    // Assert: only Av. El Descanso (approved on 25/11) counts
    expect(cut.ma01[0]).toBe(Math.round((2870 / 5800.5) * 100));
    expect(cut.sheets).toEqual(cut.ma01);
    expect(cut.avance).toEqual(cut.ma01);
    expect(cut.capas).toEqual(cut.ma01);
  });

  it('keeps the same map without a stage or a cut', () => {
    expect(layerScopeOf(MAP, {})).toBe(MAP);
    expect(layerScopeOf(MAP, { workId: 'imp' })).toBe(MAP);
  });
});

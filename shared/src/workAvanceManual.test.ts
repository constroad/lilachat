import { describe, expect, it, vi } from 'vitest';
import type { WorkMap } from './workMap.js';
import type { MapEditSend } from './workScopeDraft.js';
import { MANUAL_NO_LENGTH } from './workManualProgress.js';
import { pendingAlready } from './workByApprove.js';
import { BRUSH_REACH_M } from './workMapBrush.js';
import { avanceAlready, avanceRangeProblem, avanceStartsLater, avanceTargetOf, runAvanceSave } from './workAvanceMode.js';
import { addManualMark, avanceStreetAtTap, manualHandlesOf, manualRangeOf, manualRangeSummary, measureOnStreet, moveManualMark, tapReachM } from './workAvanceManual.js';

/** «Marcar a mano» (José 28/11): short patches on long roads, two taps set «desde» and «hasta». */
const EAST = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }];
const NORTH = [{ lat: -11.999, lng: -77.002 }, { lat: -11.998, lng: -77.002 }];
const MAP: WorkMap = {
  streets: [{ id: 'lima', name: 'Jirón Lima parche 02', line: EAST, lengthM: 109 }, { id: 'grau', name: 'Jr. Grau', line: NORTH, lengthM: 111 }],
  scopes: [{ id: 'c1', streetId: 'lima', fromM: 10, toM: 109, workIds: ['imp'] }],
  progress: [{ streetId: 'lima', workId: 'imp', fromM: 60, toM: 80, date: '2026-11-20', rework: false }],
  works: [{ id: 'imp', name: 'Imprimación', color: '#2563eb' }],
  stages: [],
  pending: [{ streetId: 'lima', workId: 'imp', fromM: 80, toM: 90 }],
};
const IDS = { scope: 'scope-entry', progress: 'progress-entry' };

describe('the tap that picks a street (José 28/11)', () => {
  it('reaches 30 px of the map: far more metres zoomed out, never under the brush reach zoomed in', () => {
    // Arrange / Act
    const zoomedOut = tapReachM(13, -12);
    const zoomedIn = tapReachM(20, -12);
    // Assert
    expect(zoomedOut).toBeGreaterThan(400);
    expect(zoomedIn).toBe(BRUSH_REACH_M);
    expect(tapReachM(undefined, -12)).toBe(BRUSH_REACH_M);
  });

  it('snaps to the nearest street within reach and to none when the tap is off every street', () => {
    // Arrange: 0.0003° of latitude is ~33 m north of Jirón Lima
    const near = { lat: -11.9997, lng: -76.9995 };
    // Act / Assert
    expect(avanceStreetAtTap(MAP, near, 40)).toBe('lima');
    expect(avanceStreetAtTap(MAP, near, 20)).toBeNull();
    expect(avanceStreetAtTap(MAP, { lat: -11.9985, lng: -77.002 }, 40)).toBe('grau');
  });
});

describe('the two taps of «Marcar a mano»', () => {
  const street = MAP.streets[0]!;

  it('projects a tap onto the axis and snaps past an end to that end', () => {
    expect(measureOnStreet(street, { lat: -12.0001, lng: -76.9995 })).toBe(54);
    expect(measureOnStreet(street, { lat: -12, lng: -76.99 })).toBe(109);
    expect(measureOnStreet(street, { lat: -12, lng: -77.01 })).toBe(0);
  });

  it('first tap is one ring, the second closes the stretch in order, a third starts over', () => {
    // Arrange / Act
    const one = addManualMark([], 40);
    const two = addManualMark(one, 12);
    const three = addManualMark(two, 70);
    // Assert
    expect(manualRangeOf(one)).toBeNull();
    expect(manualRangeOf(two)).toEqual({ fromM: 12, toM: 40 });
    expect(three).toEqual([70]);
  });

  it('a dragged ring moves its own end and the pair stays ordered', () => {
    expect(manualRangeOf(moveManualMark([12, 40], 'end', 5))).toEqual({ fromM: 5, toM: 12 });
    expect(manualRangeOf(moveManualMark([12, 40], 'start', 20))).toEqual({ fromM: 20, toM: 40 });
    expect(moveManualMark([12], 'start', 30)).toEqual([30]);
  });

  it('draws a ring per end with its chainage and says «+N m · desde → hasta»', () => {
    // Act
    const handles = manualHandlesOf(street, [6, 2]);
    // Assert
    expect(handles.map((one) => [one.handle, one.label])).toEqual([['start', '0+002'], ['end', '0+006']]);
    expect(handles[0]!.key).not.toBe(manualHandlesOf(street, [3, 6])[0]!.key);
    expect(manualHandlesOf(undefined, [2, 6])).toEqual([]);
    expect(manualRangeSummary({ fromM: 2, toM: 6 })).toBe('+4 m · 0+002 → 0+006');
  });
});

describe('what a hand-marked stretch may cover', () => {
  const target = avanceTargetOf(MAP, 'lima', 'imp')!;

  it('a free stretch behind the front goes; an approved or waiting one says why', () => {
    expect(avanceRangeProblem(MAP, target, { fromM: 20, toM: 50 })).toBeNull();
    expect(avanceRangeProblem(MAP, target, { fromM: 50, toM: 70 })).toBe(avanceAlready(target.doneM, 'Imprimación'));
    expect(avanceRangeProblem(MAP, target, { fromM: 40, toM: 85 })).toBe(avanceAlready(target.doneM, 'Imprimación'));
  });

  it('a stretch over what waits approval, one before the work starts, empty or past the street are refused', () => {
    const noApproved = { ...MAP, progress: [] };
    const fresh = avanceTargetOf(noApproved, 'lima', 'imp')!;
    expect(avanceRangeProblem(noApproved, fresh, { fromM: 70, toM: 85 })).toBe(pendingAlready(90));
    expect(avanceRangeProblem(MAP, target, { fromM: 2, toM: 30 })).toBe(avanceStartsLater(10));
    expect(avanceRangeProblem(MAP, target, { fromM: 30, toM: 30 })).toBe(MANUAL_NO_LENGTH);
    expect(avanceRangeProblem(MAP, target, { fromM: 95, toM: 200 })).not.toBeNull();
    expect(avanceRangeProblem(MAP, target, { fromM: 95, toM: 105 })).toBeNull();
  });

  it('«Guardar avance» sends the hand-marked «desde» and «hasta» through the same door', async () => {
    // Arrange
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: 'Enviado' }));
    // Act
    const answer = await runAvanceSave({ map: MAP, target, toM: null, range: { fromM: 20, toM: 50 }, ids: IDS, now: new Date('2026-11-28T15:00:00Z'), send });
    // Assert
    expect(answer.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({ kind: 'work_manual_progress', from_m: 20, to_m: 50 });
  });

  it('a refused stretch sends nothing', async () => {
    const send = vi.fn<MapEditSend>();
    const answer = await runAvanceSave({ map: MAP, target, toM: null, range: { fromM: 50, toM: 70 }, ids: IDS, now: new Date(), send });
    expect(answer.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('Modo Avance lines', () => {
  it('the picked street, or only the hand-marked stretch, goes thick in the layer colour', async () => {
    const { avanceLinesOf } = await import('./workAvanceManual.js');
    const whole = avanceLinesOf(MAP, 'imp', 'grau', null);
    const marked = avanceLinesOf(MAP, 'imp', 'lima', { fromM: 20, toM: 50 });
    expect(whole.at(-1)).toMatchObject({ streetId: 'grau', color: '#2563eb' });
    expect(marked.at(-1)).toMatchObject({ streetId: 'lima', color: '#2563eb' });
    expect(avanceLinesOf(MAP, null, null, null)).toEqual([]);
  });
});

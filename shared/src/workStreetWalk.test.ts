import { describe, expect, it } from 'vitest';
import { EMPTY_STREET, streetDraftLengthM, streetDraftProblem, DRAFT_NEEDS_POINTS } from './workStreetDraft.js';
import { setDrawMode } from './workStreetPick.js';
import { WALK_IDLE, WALK_MAX_ACCURACY_M, pauseWalk, resumeWalk, startWalk, stopWalk, undoWalkStep, walkFix, walkHint, walkPositionPins, walkedDraft, type GpsFix } from './workStreetWalk.js';
import { lineLengthM as lineLengthMOf } from './workMap.js';

/** Design o-13 (step 3, José 07/11): the engineer walks the street's axis and the phone draws it. */
const M_PER_DEG_LNG = 111_195 * Math.cos((12 * Math.PI) / 180);
const fix = (meters: number, accuracyM = 4) => ({ lat: -12, lng: -77 + meters / M_PER_DEG_LNG, accuracyM });

describe('walking a street with GPS', () => {
  it('records nothing until «Empezar», then a point every few metres', () => {
    // Arrange
    let walk = walkFix(WALK_IDLE, fix(0));
    expect(walk.points).toHaveLength(0);
    walk = startWalk(walk);
    // Act
    for (const meters of [0, 2, 6, 12, 40]) walk = walkFix(walk, fix(meters));
    // Assert: 2 m is too close to 0 to count.
    expect(walk.points).toHaveLength(4);
    expect(walk.accuracyM).toBe(4);
  });

  it('a fix worse than the limit is shown but not drawn', () => {
    let walk = startWalk(WALK_IDLE);
    walk = walkFix(walk, fix(0));
    walk = walkFix(walk, fix(30, WALK_MAX_ACCURACY_M + 1));
    expect(walk.points).toHaveLength(1);
    expect(walk.accuracyM).toBe(WALK_MAX_ACCURACY_M + 1);
    expect(walkHint(walk)).toContain('GPS débil');
  });

  it('«Terminar» stops recording and the line is the street\'s, by hand', () => {
    let walk = startWalk(WALK_IDLE);
    for (const meters of [0, 50, 100]) walk = walkFix(walk, fix(meters));
    walk = stopWalk(walk);
    walk = walkFix(walk, fix(150));
    const draft = walkedDraft({ ...setDrawMode(EMPTY_STREET, 'gps'), name: 'Jr. Los Pinos' }, walk);
    expect(draft.points).toHaveLength(3);
    expect(streetDraftLengthM(draft)).toBe(100);
    expect(streetDraftProblem(draft)).toBeNull();
  });

  it('says what to do at each moment', () => {
    expect(walkHint(WALK_IDLE)).toBe('Toca «Empezar» y camina por el eje de la calle.');
    let walk = startWalk(WALK_IDLE);
    expect(walkHint(walk)).toBe('Buscando señal de GPS…');
    walk = walkFix(walkFix(walk, fix(0)), fix(85));
    expect(walkHint(walk)).toBe('Caminando · 85 m · GPS ±4 m');
    expect(walkHint(stopWalk(walk))).toBe('Listo: 85 m caminados. Si no es así, toca Deshacer.');
  });

  it('a walk with fewer than two points cannot be saved', () => {
    const draft = walkedDraft(setDrawMode(EMPTY_STREET, 'gps'), stopWalk(walkFix(startWalk(WALK_IDLE), fix(0))));
    expect(streetDraftProblem(draft)).toBe(DRAFT_NEEDS_POINTS);
  });
});

describe('o-13 walk controls (audit 08/11 item 12)', () => {
  const M_PER_DEG = 111_195 * Math.cos((12 * Math.PI) / 180);
  const fixAt = (meters: number, accuracyM = 4): GpsFix => ({ lat: -12, lng: -77 + meters / M_PER_DEG, accuracyM });
  const walked = (...meters: number[]) => meters.reduce((walk, at) => walkFix(walk, fixAt(at)), startWalk(WALK_IDLE));

  it('«Pausa» keeps the line still while the phone keeps showing where it is', () => {
    const paused = walkFix(pauseWalk(walked(0, 10, 20)), fixAt(60));
    expect(paused.points).toHaveLength(3);
    expect(paused.position).toMatchObject({ lng: fixAt(60).lng });
    expect(walkHint(paused)).toBe('En pausa · 20 m caminados. Toca «Seguir» para continuar.');
    expect(walkFix(resumeWalk(paused), fixAt(70)).points).toHaveLength(4);
  });

  it('counts the readings it discarded for a weak signal, and says it', () => {
    const walk = walkFix(walkFix(walked(0, 10), fixAt(20, 40)), fixAt(30, 60));
    expect(walk.discarded).toBe(2);
    expect(walkHint(walkFix(walk, fixAt(40)))).toBe('Caminando · 40 m · GPS ±4 m · 2 lecturas descartadas');
  });

  it('«Deshacer último tramo» takes back about the last twenty metres, not the whole walk', () => {
    const walk = walked(0, 10, 20, 30, 40, 50);
    expect(undoWalkStep(walk).points).toHaveLength(4);
    expect(lineLengthMOf(undoWalkStep(walk).points)).toBeCloseTo(30, 0);
    expect(undoWalkStep(walked(0)).points).toEqual([]);
  });

  it('the position is a pin on the map while walking', () => {
    expect(walkPositionPins(walked(0, 10))).toEqual([expect.objectContaining({ id: 'mi-posicion', lat: -12 })]);
    expect(walkPositionPins(WALK_IDLE)).toEqual([]);
  });
});

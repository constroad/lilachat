import { describe, expect, it } from 'vitest';
import { EMPTY_STREET, streetDraftLengthM, streetDraftProblem, DRAFT_NEEDS_POINTS } from './workStreetDraft.js';
import { setDrawMode } from './workStreetPick.js';
import { WALK_IDLE, WALK_MAX_ACCURACY_M, startWalk, stopWalk, walkFix, walkHint, walkedDraft } from './workStreetWalk.js';

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

import { describe, expect, it } from 'vitest';
import { EMPTY_STREET, streetDraftLengthM, streetDraftPins, streetDraftProblem, DRAFT_NEEDS_STREET } from './workStreetDraft.js';
import { handPointsLabel, modeChangeLoss, NO_STREET_THERE, setDrawMode, streetDraftArea, streetDraftEnds, streetDraftHint, tapStreetDraft, undoStreetDraft } from './workStreetPick.js';

/** Audit 07/11 (José: «fácil y fluido para un ingeniero de campo»): tap the street, then its start and end. */
const M_PER_DEG_LNG = 111_195 * Math.cos((12 * Math.PI) / 180);
const east = (meters: number) => ({ lat: -12, lng: -77 + meters / M_PER_DEG_LNG });
const road = (name: string | undefined, from: number, to: number) => ({ properties: { class: 'minor', ...(name ? { name } : {}) }, geometry: { type: 'LineString', coordinates: [[east(from).lng, -12], [east(to).lng, -12]] } });
const at = (meters: number) => ({ underFinger: [road(undefined, 0, 500)], nearby: [road('Jr. Los Pinos', 0, 500)], tap: east(meters) });

describe('drawing a street by tapping it', () => {
  it('a tap on a street brings it whole, named, and asks for the start', () => {
    const { draft, problem } = tapStreetDraft(EMPTY_STREET, at(100));
    expect(problem).toBeNull();
    expect(draft.name).toBe('Jr. Los Pinos');
    expect(streetDraftLengthM(draft)).toBe(500);
    expect(streetDraftHint(draft)).toBe('Toca dónde empieza la obra, o guarda la calle entera.');
  });

  it('two taps on it keep only the stretch of work, with its chainage', () => {
    let draft = tapStreetDraft(EMPTY_STREET, at(100)).draft;
    draft = tapStreetDraft(draft, at(320)).draft;
    draft = tapStreetDraft(draft, at(80)).draft;
    expect(streetDraftLengthM(draft)).toBe(240);
    expect(streetDraftEnds(draft)).toBe('Inicio 0+000 · Fin 0+240');
    expect(streetDraftProblem(draft)).toBeNull();
  });

  it('«Deshacer» goes back one tap at a time, and the map\'s name leaves with its street', () => {
    let draft = tapStreetDraft(EMPTY_STREET, at(100)).draft;
    draft = tapStreetDraft(tapStreetDraft(draft, at(320)).draft, at(80)).draft;
    draft = undoStreetDraft(draft);
    expect(streetDraftHint(draft)).toBe('Toca dónde termina la obra.');
    draft = undoStreetDraft(undoStreetDraft(draft));
    expect(draft).toMatchObject({ pick: null, points: [], name: '' });
  });

  it('a name the person wrote stays when they pick another street', () => {
    const picked = tapStreetDraft({ ...EMPTY_STREET, name: 'Cuadra 3' }, at(100)).draft;
    expect(picked.name).toBe('Cuadra 3');
  });

  it('a tap where there is no street says so, and nothing changes', () => {
    const { draft, problem } = tapStreetDraft(EMPTY_STREET, { underFinger: [], nearby: [], tap: east(10) });
    expect(problem).toBe(NO_STREET_THERE);
    expect(draft).toBe(EMPTY_STREET);
    expect(streetDraftProblem(draft)).toBe(DRAFT_NEEDS_STREET);
  });

  it('«A mano» adds each tap as a bend, and switching way starts the line again keeping name and width', () => {
    const hand = setDrawMode({ ...EMPTY_STREET, name: 'Pasaje 2', widthM: 4 }, 'hand');
    const drawn = tapStreetDraft(tapStreetDraft(hand, at(0)).draft, at(50)).draft;
    expect(drawn.points).toHaveLength(2);
    expect(setDrawMode(drawn, 'street')).toMatchObject({ mode: 'street', points: [], name: 'Pasaje 2', widthM: 4 });
  });
});

describe('what the picked street shows (side-by-side audit 07/11)', () => {
  it('the saved street starts at 0+000: its chainage is its own, not the map road\'s', () => {
    const whole = tapStreetDraft(EMPTY_STREET, at(100)).draft;
    expect(streetDraftEnds(whole)).toBe('Inicio 0+000 · Fin 0+500');
  });

  it('only the start and the end carry a pin, numbered 1 and 2, however bent the road is', () => {
    const bent = { ...at(100), nearby: [{ properties: { class: 'minor', name: 'Jr. Curvo' }, geometry: { type: 'LineString', coordinates: [[east(0).lng, -12], [east(100).lng, -12.0001], [east(200).lng, -12], [east(300).lng, -12.0001]] } }] };
    const draft = tapStreetDraft(EMPTY_STREET, bent).draft;
    expect(draft.points.length).toBeGreaterThan(2);
    expect(streetDraftPins(draft).map((pin) => pin.label)).toEqual(['1', '2']);
  });

  it('by hand every bend keeps its number', () => {
    const hand = { ...EMPTY_STREET, mode: 'hand' as const, points: [east(0), east(10), east(20)] };
    expect(streetDraftPins(hand).map((pin) => pin.label)).toEqual(['1', '2', '3']);
  });

  it('the net area is length times width, and waits for both', () => {
    const draft = tapStreetDraft(tapStreetDraft(tapStreetDraft(EMPTY_STREET, at(100)).draft, at(320)).draft, at(0)).draft;
    expect(streetDraftArea(draft)).toBeNull();
    expect(streetDraftArea({ ...draft, widthM: 6 })).toBe('1 920 m²');
    expect(streetDraftArea({ ...EMPTY_STREET, widthM: 6 })).toBeNull();
    expect(streetDraftArea({ ...draft, widthM: 0 })).toBeNull();
  });
});

describe('the start is where the person tapped first (web E2E 07/11)', () => {
  it('marking the end before the start in the road\'s direction turns the line around', () => {
    // Arrange: the map's road runs from 0 to 500; the person starts at 320 and ends at 80.
    let draft = tapStreetDraft(EMPTY_STREET, at(100)).draft;
    // Act
    draft = tapStreetDraft(tapStreetDraft(draft, at(320)).draft, at(80)).draft;
    // Assert
    expect(draft.points[0]!.lng).toBeCloseTo(east(320).lng, 6);
    expect(draft.points.at(-1)!.lng).toBeCloseTo(east(80).lng, 6);
    expect(streetDraftEnds(draft)).toBe('Inicio 0+000 · Fin 0+240');
  });

  it('in the road\'s direction it stays as it is', () => {
    let draft = tapStreetDraft(EMPTY_STREET, at(100)).draft;
    draft = tapStreetDraft(tapStreetDraft(draft, at(80)).draft, at(320)).draft;
    expect(draft.points[0]!.lng).toBeCloseTo(east(80).lng, 6);
  });

  it('«Deshacer» on a turned line keeps the first tap as the start', () => {
    let draft = tapStreetDraft(EMPTY_STREET, at(100)).draft;
    draft = tapStreetDraft(tapStreetDraft(draft, at(320)).draft, at(80)).draft;
    draft = undoStreetDraft(draft);
    expect(draft.pick?.fromM).toBeCloseTo(320, 0);
    expect(draft.reversed).toBe(false);
  });
});

describe('modeChangeLoss (o-02: switching the way to draw no longer wipes the street silently)', () => {
  const marked = { ...EMPTY_STREET, points: [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }] };

  it('names what a switch would erase', () => {
    expect(modeChangeLoss(marked, 'gps')).toBe('Cambiar de forma borra lo que marcaste (109 m). ¿Cambiar igual?');
  });

  it('asks nothing when nothing is marked or the mode stays', () => {
    expect(modeChangeLoss(EMPTY_STREET, 'gps')).toBeNull();
    expect(modeChangeLoss(marked, 'street')).toBeNull();
  });

  it('a single point is still work to lose', () => {
    expect(modeChangeLoss({ ...EMPTY_STREET, points: [{ lat: -12, lng: -77 }] }, 'hand')).toBe('Cambiar de forma borra lo que marcaste (1 punto). ¿Cambiar igual?');
  });

  it('the stage chosen survives the switch', () => {
    expect(setDrawMode({ ...marked, stageId: 'e1' }, 'gps').stageId).toBe('e1');
  });
});

describe('handPointsLabel (APK E2E 08/11: the hand counter read «1 puntos»)', () => {
  it('singular for one point, plural otherwise', () => {
    expect(handPointsLabel(1)).toBe('1 punto');
    expect(handPointsLabel(0)).toBe('0 puntos');
    expect(handPointsLabel(3)).toBe('3 puntos');
  });
});

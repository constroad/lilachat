import { describe, expect, it } from 'vitest';
import { EMPTY_STREET, streetDraftLengthM, streetDraftProblem, DRAFT_NEEDS_STREET } from './workStreetDraft.js';
import { NO_STREET_THERE, setDrawMode, streetDraftEnds, streetDraftHint, tapStreetDraft, undoStreetDraft } from './workStreetPick.js';

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
    expect(streetDraftEnds(draft)).toBe('Inicio 0+080 · Fin 0+320');
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

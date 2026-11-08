import { describe, expect, it, vi } from 'vitest';
import { FORMS_LEVEL } from './appForms';
import { addStreetPoint, DRAFT_BAD_WIDTH, saveStreetWithStage, sendWorkStreet, STREET_FAILED, STREET_SAVED, STREET_STAGE_FAILED, workStreetRequest, streetDraftLines, streetDraftPins, WORK_MAP_DRAFT_COLOR, DRAFT_NAME_TOO_LONG, DRAFT_NEEDS_NAME, DRAFT_NEEDS_POINTS, EMPTY_STREET, STREET_POINTS_MAX, streetDraftLengthM, streetDraftProblem, undoStreetPoint, type StreetDraft } from './workStreetDraft';

/** About 100 m east along -12, the way a street is tapped on the map (design o-02). */
const START = { lat: -12, lng: -77 };
const HUNDRED_M_EAST = { lat: -12, lng: -77 + 100 / (111_195 * Math.cos((12 * Math.PI) / 180)) };
const drawn = (over: Partial<StreetDraft> = {}): StreetDraft => ({ ...EMPTY_STREET, name: 'Jr. Los Pinos', points: [START, HUNDRED_M_EAST], ...over });

describe('drawing a street (design o-02)', () => {
  it('each tap adds a bend and «Deshacer» takes back the last one', () => {
    // Act
    const two = addStreetPoint(addStreetPoint(EMPTY_STREET, START), HUNDRED_M_EAST);
    const back = undoStreetPoint(two);
    // Assert
    expect(two.points).toEqual([START, HUNDRED_M_EAST]);
    expect(back.points).toEqual([START]);
    expect(undoStreetPoint(EMPTY_STREET).points).toEqual([]);
  });

  it('keeps only the coordinates of a tap, whatever else the map sends', () => {
    const point = { lat: -12, lng: -77, x: 10, y: 20 } as unknown as typeof START;
    expect(addStreetPoint(EMPTY_STREET, point).points[0]).toEqual({ lat: -12, lng: -77 });
  });

  it('stops adding at Portal\'s limit instead of failing on save', () => {
    const full = { ...EMPTY_STREET, points: Array.from({ length: STREET_POINTS_MAX }, () => START) };
    expect(addStreetPoint(full, HUNDRED_M_EAST).points).toHaveLength(STREET_POINTS_MAX);
  });

  it('reads the length in whole meters while drawing, and 0 with a single tap', () => {
    expect(streetDraftLengthM(drawn())).toBe(100);
    expect(streetDraftLengthM({ points: [START] })).toBe(0);
  });
});

describe('what stops «Guardar calle»', () => {
  it('asks for the start and the end first, then the name', () => {
    expect(streetDraftProblem(drawn({ points: [START], name: '', mode: 'hand' }))).toBe(DRAFT_NEEDS_POINTS);
    expect(streetDraftProblem(drawn({ name: '   ' }))).toBe(DRAFT_NEEDS_NAME);
  });

  it('a name past the limit and a width out of range say so', () => {
    expect(streetDraftProblem(drawn({ name: 'x'.repeat(81) }))).toBe(DRAFT_NAME_TOO_LONG);
    expect(streetDraftProblem(drawn({ widthM: 0 }))).toBe(DRAFT_BAD_WIDTH);
    expect(streetDraftProblem(drawn({ widthM: 61 }))).toBe(DRAFT_BAD_WIDTH);
    expect(streetDraftProblem(drawn({ widthM: Number.NaN }))).toBe(DRAFT_BAD_WIDTH);
  });

  it('a drawn and named street is ready, with or without a width', () => {
    expect(streetDraftProblem(drawn())).toBeNull();
    expect(streetDraftProblem(drawn({ widthM: 6 }))).toBeNull();
  });
});

describe('the street being drawn, on the map', () => {
  it('numbers each tap and draws the line once there are two', () => {
    // Act
    const pins = streetDraftPins(drawn());
    const lines = streetDraftLines(drawn());
    // Assert
    expect(pins.map((pin) => pin.label)).toEqual(['1', '2']);
    expect(pins.every((pin) => !pin.outside)).toBe(true);
    expect(lines).toHaveLength(1);
    expect(lines[0].coordinates).toEqual([[START.lng, START.lat], [HUNDRED_M_EAST.lng, HUNDRED_M_EAST.lat]]);
    expect(lines[0].color).toBe(WORK_MAP_DRAFT_COLOR);
  });

  it('a single tap is a pin, not a line', () => {
    expect(streetDraftLines(drawn({ points: [START] }))).toEqual([]);
    expect(streetDraftPins(drawn({ points: [START] }))).toHaveLength(1);
  });
});

describe('saving the street through Portal (guardar_calle_de_obra)', () => {
  const ENTRY = '7a1e2c1a-2222-4333-8444-555566667777';

  it('sends the trimmed name, the line, the width only when given, and the phone\'s entry', () => {
    expect(workStreetRequest(drawn({ name: '  Jr. Los Pinos ', widthM: 6 }), ENTRY)).toEqual({ kind: 'work_street', name: 'Jr. Los Pinos', line: [START, HUNDRED_M_EAST], width_m: 6, entry_id: ENTRY, forms: FORMS_LEVEL });
    expect(workStreetRequest(drawn(), ENTRY)).not.toHaveProperty('width_m');
  });

  it('confirms the tool with nothing to fill and reads Portal\'s answer', async () => {
    // Arrange
    const submit = vi.fn(async () => ({ ok: true as const, outcome: { outcome: 'done' as const, response: { responseType: 'text' as const, text: 'Calle «Jr. Los Pinos» creada (100 m).' } } }));
    const deps = { open: async () => ({ ok: true as const, data: { commandId: 'c1', appId: 'a', appName: 'Portal', outcome: 'form' as const } }), submit, notice: vi.fn() };
    // Act
    const sent = await sendWorkStreet(deps as never);
    // Assert
    expect(submit).toHaveBeenCalledWith('c1', {});
    expect(sent).toEqual({ ok: true, message: 'Calle «Jr. Los Pinos» creada (100 m).' });
  });

  it('a refusal shows Portal\'s own words', async () => {
    const deps = { open: async () => ({ ok: true as const, data: { commandId: 'c1' } }), submit: async () => ({ ok: false as const, message: 'Ese tramo ya tiene avance aprobado entre 0+040 y 0+120.' }), notice: vi.fn() };
    expect(await sendWorkStreet(deps as never)).toEqual({ ok: false, message: 'Ese tramo ya tiene avance aprobado entre 0+040 y 0+120.' });
  });

  it('without signal it says what to do', async () => {
    const deps = { open: async () => ({ ok: false as const }), submit: vi.fn(), notice: vi.fn() };
    expect(await sendWorkStreet(deps as never)).toEqual({ ok: false, message: STREET_FAILED });
  });
});

describe('saveStreetWithStage (o-02: the stage is chosen with the street)', () => {
  const saved = { ok: true as const, message: STREET_SAVED, data: { calleId: '6af000000000000000000001', largoM: 320, creada: true } };

  it('without a stage only the street is saved', async () => {
    const scope = vi.fn();
    expect(await saveStreetWithStage(async () => saved, scope, undefined, 'e-1')).toEqual(saved);
    expect(scope).not.toHaveBeenCalled();
  });

  it('with a stage, a stretch over the whole street carries it', async () => {
    const scope = vi.fn(async () => ({ ok: true as const, message: 'ok' }));
    const result = await saveStreetWithStage(async () => saved, scope, 'e2', 'e-1');
    expect(scope).toHaveBeenCalledWith({ kind: 'work_scope', street_id: '6af000000000000000000001', from_m: 0, to_m: 320, tag_ids: [], partida_ids: [], stage_id: 'e2', entry_id: 'e-1-etapa', forms: FORMS_LEVEL });
    expect(result).toEqual({ ok: true, message: STREET_SAVED });
  });

  it('a stage that fails keeps the street and says where to finish', async () => {
    const result = await saveStreetWithStage(async () => saved, async () => ({ ok: false, message: 'x' }), 'e2', 'e-1');
    expect(result).toEqual({ ok: true, message: STREET_STAGE_FAILED });
  });

  it('a street that fails sends no stage, and an answer without the id cannot place it', async () => {
    const scope = vi.fn();
    expect(await saveStreetWithStage(async () => ({ ok: false, message: STREET_FAILED }), scope, 'e2', 'e-1')).toEqual({ ok: false, message: STREET_FAILED });
    expect(await saveStreetWithStage(async () => ({ ok: true, message: STREET_SAVED }), scope, 'e2', 'e-1')).toEqual({ ok: true, message: STREET_STAGE_FAILED });
    expect(scope).not.toHaveBeenCalled();
  });
});

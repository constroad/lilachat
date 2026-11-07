import { describe, expect, it } from 'vitest';
import type { WorkMap, WorkMapPoint } from './workMap.js';
import {
  confirmDischargeLabel,
  dischargeHeadline,
  suggestDischarges,
  type UnitDischarge,
} from './workMapDischarges.js';

const METERS_PER_DEGREE = 111_195;
const START: WorkMapPoint = { lat: -12.05, lng: -77.03 };
const STREET_ID = '6aee73fa80fb948f67e89b8c';
const CROSS_STREET_ID = '6aee73fa80fb948f67e89b8d';

const north = (meters: number, sideM = 0): WorkMapPoint => ({
  lat: START.lat + meters / METERS_PER_DEGREE,
  lng: START.lng + sideM / (METERS_PER_DEGREE * Math.cos((START.lat * Math.PI) / 180)),
});

const workMap = (): WorkMap => ({
  streets: [
    { id: STREET_ID, name: 'Jr. Los Pinos', line: [north(0), north(320)], lengthM: 320 },
    { id: CROSS_STREET_ID, name: 'Av. Los Incas', line: [north(150, -200), north(150, 200)], lengthM: 400 },
  ],
  scopes: [],
  progress: [],
  works: [],
  stages: [],
});

const unit = (dispatchId: string, plate: string, m3: number | null, ...places: WorkMapPoint[]): UnitDischarge => ({
  dispatchId,
  plate,
  m3,
  arrivalAt: `2026-11-06T12:0${dispatchId.slice(-1)}:00.000Z`,
  points: places.map((place, index) => ({ kind: index === 0 ? 'ingreso' : 'vacia', ...place, at: '2026-11-06T12:30:00.000Z' })),
});

describe('suggestDischarges', () => {
  it('places a unit on the stretch between its first and last photo', () => {
    // Arrange
    const units = [unit('6aeea2fdf3e8b385195281f1', 'QAP-101', 7.5, north(120), north(144))];

    // Act
    const suggestion = suggestDischarges(workMap(), units);

    // Assert
    expect(suggestion.units[0]).toMatchObject({ state: 'placed', streetId: STREET_ID });
    const placed = suggestion.units[0];
    if (placed?.state !== 'placed') throw new Error('expected a placed unit');
    expect(placed.fromM).toBeCloseTo(120, 0);
    expect(placed.toM).toBeCloseTo(144, 0);
  });

  it('accepts a photo taken from the sidewalk', () => {
    // Arrange
    const units = [unit('6aeea2fdf3e8b385195281f1', 'QAP-101', 8, north(60, 9))];

    // Act
    const { units: placed } = suggestDischarges(workMap(), units);

    // Assert
    expect(placed[0]?.state).toBe('placed');
  });

  it('marks a unit far from every street as outside, and keeps where it was', () => {
    // Arrange
    const far = north(40, 180);
    const units = [unit('6aeea2fdf3e8b385195281f4', 'QAP-103', 7.5, far)];

    // Act
    const suggestion = suggestDischarges(workMap(), units);

    // Assert
    expect(suggestion.units[0]).toMatchObject({ state: 'outside', point: far });
    expect(suggestion.stretches).toEqual([]);
  });

  it('leaves a unit whose photos have no place apart', () => {
    // Arrange
    const units = [unit('6aeea2fdf3e8b385195281f1', 'QAP-101', 7.5)];

    // Act
    const suggestion = suggestDischarges(workMap(), units);

    // Assert
    expect(suggestion.units[0]?.state).toBe('noPlace');
  });

  it('does not trust a photo whose GPS was too imprecise', () => {
    // Arrange
    const shaky: UnitDischarge = {
      ...unit('6aeea2fdf3e8b385195281f1', 'QAP-101', 7.5),
      points: [{ kind: 'vacia', ...north(100), precisionM: 80, at: '2026-11-06T12:30:00.000Z' }],
    };

    // Act
    const suggestion = suggestDischarges(workMap(), [shaky]);

    // Assert
    expect(suggestion.units[0]?.state).toBe('noPlace');
  });

  it('keeps a unit on the street where most of its photos fall', () => {
    // Arrange: two photos on the cross street, one right at the corner of the main one.
    const units = [unit('6aeea2fdf3e8b385195281f1', 'QAP-101', 8, north(150, 2), north(150, 40), north(150, 70))];

    // Act
    const suggestion = suggestDischarges(workMap(), units);

    // Assert
    expect(suggestion.units[0]).toMatchObject({ state: 'placed', streetId: CROSS_STREET_ID });
  });

  it('sums one stretch per street from the units placed on it', () => {
    // Arrange
    const units = [
      unit('6aeea2fdf3e8b385195281f1', 'QAP-101', 7.5, north(120), north(144)),
      unit('6aeea2fdf3e8b385195281f2', 'QAP-104', null, north(144), north(170)),
      unit('6aeea2fdf3e8b385195281f3', 'QAP-102', 8, north(220), north(240)),
      unit('6aeea2fdf3e8b385195281f4', 'QAP-103', 7, north(40, 180)),
    ];

    // Act
    const { stretches } = suggestDischarges(workMap(), units);

    // Assert
    expect(stretches).toHaveLength(1);
    expect(stretches[0]).toMatchObject({ streetId: STREET_ID, streetName: 'Jr. Los Pinos', volumeM3: 15.5 });
    // Portal checks these units belong to the order and dates the stretch from their photos (agentes 07/11).
    expect(stretches[0]?.dispatchIds).toEqual(['6aeea2fdf3e8b385195281f1', '6aeea2fdf3e8b385195281f2', '6aeea2fdf3e8b385195281f3']);
    expect(stretches[0]?.fromM).toBeCloseTo(120, 0);
    expect(stretches[0]?.toM).toBeCloseTo(240, 0);
    expect(stretches[0]?.lengthM).toBeCloseTo(120, 0);
  });

  it('lists the units in the order they arrived, the ones without an hour last', () => {
    // Arrange
    const late = unit('6aeea2fdf3e8b385195281f3', 'QAP-102', 8, north(10));
    const early = unit('6aeea2fdf3e8b385195281f1', 'QAP-101', 8, north(20));
    const unknown = { ...unit('6aeea2fdf3e8b385195281f2', 'QAP-104', 8, north(30)), arrivalAt: null };

    // Act
    const { units } = suggestDischarges(workMap(), [unknown, late, early]);

    // Assert
    expect(units.map((one) => one.unit.plate)).toEqual(['QAP-101', 'QAP-102', 'QAP-104']);
  });

  it('answers nothing to suggest on a map without streets', () => {
    // Arrange
    const empty: WorkMap = { ...workMap(), streets: [] };
    const units = [unit('6aeea2fdf3e8b385195281f1', 'QAP-101', 7.5, north(120))];

    // Act
    const suggestion = suggestDischarges(empty, units);

    // Assert
    expect(suggestion.units[0]?.state).toBe('outside');
    expect(suggestion.stretches).toEqual([]);
  });

  it('counts as ready only the units placed on a street', () => {
    // Arrange
    const units = [
      unit('6aeea2fdf3e8b385195281f1', 'QAP-101', 7.5, north(120)),
      unit('6aeea2fdf3e8b385195281f2', 'QAP-104', 7.5, north(40, 180)),
      unit('6aeea2fdf3e8b385195281f3', 'QAP-102', 7.5),
    ];

    // Act
    const suggestion = suggestDischarges(workMap(), units);

    // Assert
    expect(dischargeHeadline(suggestion)).toBe('1 de 3 listas');
  });
});

describe('confirmDischargeLabel', () => {
  it('says the meters of the stretch', () => {
    // Arrange
    const units = [unit('6aeea2fdf3e8b385195281f1', 'QAP-101', 7.5, north(120), north(240))];

    // Act
    const { stretches } = suggestDischarges(workMap(), units);

    // Assert
    expect(stretches[0] && confirmDischargeLabel(stretches[0])).toBe('Confirmar avance (120 m)');
  });

  it('has nothing to confirm with a single point, which measures no stretch', () => {
    // Arrange
    const units = [unit('6aeea2fdf3e8b385195281f1', 'QAP-101', 7.5, north(120))];

    // Act
    const { stretches } = suggestDischarges(workMap(), units);

    // Assert
    expect(stretches[0] && confirmDischargeLabel(stretches[0])).toBeNull();
  });
});

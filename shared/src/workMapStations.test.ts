import { describe, expect, it } from 'vitest';
import type { WorkMapStreet } from './workMap.js';
import { STATION_STEP_M, stationMarkCollection, stationMarksOf } from './workMapStations.js';

/** Audit 08/11 item 10: the designs write the stations on the road (0+000, 0+100…), not only numbered pins. */
const M_PER_DEG_LNG = 111_195 * Math.cos((12 * Math.PI) / 180);
const street = (id: string, lengthM: number): WorkMapStreet => ({ id, name: id, lengthM, line: [{ lat: -12, lng: -77 }, { lat: -12, lng: -77 + lengthM / M_PER_DEG_LNG }] });

describe('stationMarksOf', () => {
  it('marks the start, every hundred metres and the end', () => {
    const marks = stationMarksOf([street('a', 250)]);
    expect(STATION_STEP_M).toBe(100);
    expect(marks.map((mark) => mark.label)).toEqual(['0+000', '0+100', '0+200', '0+250']);
    expect(marks[1].lng).toBeCloseTo(-77 + 100 / M_PER_DEG_LNG, 6);
    expect(marks[1].lat).toBeCloseTo(-12, 6);
  });

  it('an end too close to the last mark is not written twice over it', () => {
    expect(stationMarksOf([street('a', 210)]).map((mark) => mark.label)).toEqual(['0+000', '0+100', '0+210']);
    expect(stationMarksOf([street('a', 205)]).map((mark) => mark.label)).toEqual(['0+000', '0+100', '0+205']);
    expect(stationMarksOf([street('a', 120)]).map((mark) => mark.label)).toEqual(['0+000', '0+120']);
  });

  it('a street without a line gives no marks', () => {
    expect(stationMarksOf([{ id: 'x', name: 'x', lengthM: 100, line: [] }])).toEqual([]);
  });

  it('as points MapLibre reads', () => {
    const collection = stationMarkCollection(stationMarksOf([street('a', 120)]));
    expect(collection.features[0]).toEqual({ type: 'Feature', properties: { label: '0+000' }, geometry: { type: 'Point', coordinates: [-77, -12] } });
  });
});

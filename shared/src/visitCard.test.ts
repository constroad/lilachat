import { describe, expect, it } from 'vitest';
import type { BotBlock } from './botBlocks.js';
import { VISIT_MAP_LOOK, figureParts, visitBlocksOf, visitKickerParts, visitMapOf } from './visitCard.js';

/** The visit card lv01 (agentes 14/11), drawn the same on the web and the APK. */
type MapBlock = Extract<BotBlock, { type: 'map' }>;
const text = (tone: 'neutral' | 'warn' | 'error' | 'ok', value = 'línea'): BotBlock => ({ type: 'text', text: value, tone });

describe('visitBlocksOf', () => {
  it('takes what is missing out of the body: it goes under the buttons', () => {
    const blocks: BotBlock[] = [text('neutral', 'Calle 1'), text('warn', 'Falta: entrevista'), { type: 'tiles', items: [{ label: 'Puntos', value: '1' }] }];
    const { body, missing } = visitBlocksOf(blocks);
    expect(missing).toEqual([blocks[1]]);
    expect(body).toEqual([blocks[0], blocks[2]]);
  });

  it('counts an error line as missing too', () => {
    expect(visitBlocksOf([text('error')]).missing).toHaveLength(1);
  });

  it('leaves a card with nothing missing as it came', () => {
    const blocks = [text('neutral'), text('ok')];
    expect(visitBlocksOf(blocks)).toEqual({ body: blocks, missing: [] });
  });
});

describe('visitKickerParts', () => {
  it('splits the lead from the visit code at the last « · »', () => {
    expect(visitKickerParts('Visita técnica · VIS-2026-0075')).toEqual({ lead: 'Visita técnica · ', code: 'VIS-2026-0075' });
  });

  it('keeps a kicker without a code whole', () => {
    expect(visitKickerParts('Visita técnica')).toEqual({ lead: 'Visita técnica', code: '' });
  });

  it('answers empty for no kicker', () => {
    expect(visitKickerParts(undefined)).toEqual({ lead: '', code: '' });
  });
});

describe('figureParts', () => {
  it('splits «6 de 10» into the count and the rest', () => {
    expect(figureParts('6 de 10')).toEqual({ count: '6', rest: 'de 10' });
  });

  it('keeps a plain figure as the count', () => {
    expect(figureParts('3')).toEqual({ count: '3', rest: '' });
  });
});

describe('visitMapOf', () => {
  const base: MapBlock = { type: 'map', lat: -12.05, lng: -76.95 };

  it('numbers the points by their label, or by their order without one', () => {
    const map = visitMapOf({ ...base, points: [{ lat: -12.05, lng: -76.95, label: '1' }, { lat: -12.06, lng: -76.96, label: 'F' }, { lat: -12.07, lng: -76.97 }] });
    expect(map.points.map((point) => point.n)).toEqual(['1', 'F', 3]);
  });

  it('pins the place only when the map names it with a label', () => {
    expect(visitMapOf({ ...base, label: 'Lugar de la visita' }).place).toEqual({ lat: -12.05, lng: -76.95 });
    expect(visitMapOf(base).place).toBeUndefined();
  });

  it('says «GPS activo» with the rounded precision, and nothing without it', () => {
    expect(visitMapOf({ ...base, precisionM: 5.6 }).badge).toBe('GPS ACTIVO · ±6 m');
    expect(visitMapOf(base).badge).toBeUndefined();
  });

  it('has no points when the map came with none', () => {
    expect(visitMapOf(base).points).toEqual([]);
  });

  it('draws the visit map with its own look', () => {
    expect(VISIT_MAP_LOOK).toEqual({ height: 125, dot: 20, maxZoom: 19 });
  });
});

import { describe, expect, it } from 'vitest';
import { minutesAgo, NOW, prospectOf } from './daliTestData';
import { rowAskLineOf, rowScoreOf, rowStatusOf } from './prospectRowStatus';

const DAY_MINUTES = 24 * 60;

describe('the one pill of an inbox row (dl-01 v4)', () => {
  it('late goes first, with what is late', () => {
    const late = prospectOf({ score: 86, stage: 'to_quote', readyAt: minutesAgo(3 * DAY_MINUTES) });
    expect(rowStatusOf(late, NOW)).toEqual({ tone: 'error', text: expect.stringMatching(/^Vencido · /) });
  });

  it('then what Dali still has to ask, with its labels', () => {
    const missing = prospectOf({ score: 22, stage: 'missing_info', missing: ['servicio', 'lugar'] });
    expect(rowStatusOf(missing, NOW)).toEqual({ tone: 'warn', text: 'Falta: servicio, lugar' });
  });

  it('a plain question says «Solo consulta»; otherwise the stage', () => {
    expect(rowStatusOf(prospectOf({ score: 31, stage: 'missing_info', intent: 'information' }), NOW)).toEqual({ tone: 'neutral', text: 'Solo consulta' });
    expect(rowStatusOf(prospectOf({ score: 78, stage: 'quoted', lastActivityAt: minutesAgo(5) }), NOW).text).toBe('Cotización enviada');
  });
});

describe('the row\'s lines', () => {
  it('service and what was asked on one line; either alone; none', () => {
    expect(rowAskLineOf({ service: { key: 'venta_mezcla', name: 'Venta de mezcla' }, summary: ' Mezcla 18 m³ ' })).toBe('Venta de mezcla · Mezcla 18 m³');
    expect(rowAskLineOf({ summary: 'Solo preguntó el precio' })).toBe('Solo preguntó el precio');
    expect(rowAskLineOf({})).toBeNull();
  });

  it('the score with its level, or nothing without one', () => {
    expect(rowScoreOf(86)).toEqual({ score: 86, level: 'hot' });
    expect(rowScoreOf(undefined)).toBeNull();
  });
});

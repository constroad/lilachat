import { describe, expect, it } from 'vitest';
import { callDirection, callHistoryLabel } from './callHistory.js';

/** Pending 38 (José, 21/10): «Llamadas» in the web's rail, built from each chat's call lines. */
describe('call history', () => {
  it('who called and whether it was answered decide the direction', () => {
    expect(callDirection({ valor: 'voz:42', mine: true })).toBe('outgoing');
    expect(callDirection({ valor: 'video:42', mine: false })).toBe('incoming');
    expect(callDirection({ valor: 'voz:perdida', mine: false })).toBe('missed');
    expect(callDirection({ valor: 'video:perdida', mine: true })).toBe('unanswered');
  });

  it('a line that is not a call says nothing', () => {
    expect(callDirection({ valor: 'cualquier-cosa', mine: true })).toBeNull();
    expect(callDirection({ valor: undefined, mine: false })).toBeNull();
  });

  it('the label says the kind and the length, or what happened', () => {
    expect(callHistoryLabel({ valor: 'voz:133', mine: true })).toBe('Llamada de voz · 02:13');
    expect(callHistoryLabel({ valor: 'video:perdida', mine: false })).toBe('Videollamada perdida');
    expect(callHistoryLabel({ valor: 'voz:perdida', mine: true })).toBe('Llamada sin respuesta');
  });
});

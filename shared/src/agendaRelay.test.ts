import { describe, expect, it } from 'vitest';
import { AGENDA_MAX_PHONES, cleanNamesReply, cleanPhonesRequest, namesFromAgenda } from './agendaRelay.js';

/** Contacts on the web through the phone (José, 20/10, option «b»): nothing stored on the server. */
describe('agenda relay', () => {
  it('normalizes the requested numbers and drops repeats and garbage', () => {
    expect(cleanPhonesRequest(['960 397 018', '+51960397018', 'hola', 42, '902049935'])).toEqual(['960397018', '902049935']);
    expect(cleanPhonesRequest('960397018')).toEqual([]);
  });

  it('caps a request at the limit', () => {
    const many = Array.from({ length: AGENDA_MAX_PHONES + 50 }, (_, index) => `9${String(10000000 + index)}`);
    expect(cleanPhonesRequest(many)).toHaveLength(AGENDA_MAX_PHONES);
  });

  it('the reply only carries the numbers that were asked, with a trimmed name', () => {
    const asked = new Set(['960397018']);
    expect(cleanNamesReply({ '960397018': '  Wilson  ', '902049935': 'Otro', '999': 'x' }, asked)).toEqual({ '960397018': 'Wilson' });
    expect(cleanNamesReply({ '960397018': '' }, asked)).toEqual({});
    expect(cleanNamesReply(null, asked)).toEqual({});
  });

  it('the phone answers with the names it has, nothing for the unknown', () => {
    const agenda = new Map([['960397018', 'Wilson'], ['902049935', 'Mamá']]);
    expect(namesFromAgenda(['960397018', '911111111'], agenda)).toEqual({ '960397018': 'Wilson' });
  });
});

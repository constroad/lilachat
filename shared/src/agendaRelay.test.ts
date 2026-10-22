import { describe, expect, it } from 'vitest';
import { AGENDA_MAX_PHONES, FULL_AGENDA_MAX, cleanFullAgendaReply, cleanNamesReply, cleanPhonesRequest, fullAgendaFrom, namesFromAgenda } from './agendaRelay.js';

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

describe('the whole address book for «Nuevo chat» on the web (pending 20)', () => {
  it('the phone sends every number with its name, by name', () => {
    // Arrange
    const agenda = new Map([['987654321', 'Wilson'], ['912345678', 'Ana']]);
    // Act
    const sent = fullAgendaFrom(agenda);
    // Assert
    expect(sent).toEqual([{ phone: '912345678', name: 'Ana' }, { phone: '987654321', name: 'Wilson' }]);
  });

  it('the server keeps only real numbers with a name, once each, up to the most the match takes', () => {
    const cleaned = cleanFullAgendaReply([{ phone: '+51 987 654 321', name: ' Wilson ' }, { phone: '987654321', name: 'Repetido' }, { phone: 'abc', name: 'X' }, { phone: '912345678', name: '' }, 'junk']);
    expect(cleaned).toEqual([{ phone: '987654321', name: 'Wilson' }]);
    expect(cleanFullAgendaReply(Array.from({ length: FULL_AGENDA_MAX + 5 }, (_, index) => ({ phone: `9${String(index).padStart(8, '0')}`, name: `N${index}` })))).toHaveLength(FULL_AGENDA_MAX);
  });

  it('anything that is not a list is nothing', () => {
    expect(cleanFullAgendaReply({ phone: '987654321' })).toEqual([]);
  });
});

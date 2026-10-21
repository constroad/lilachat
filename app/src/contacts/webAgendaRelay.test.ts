import { describe, expect, it, vi } from 'vitest';
import { answerAgendaRequest } from './webAgendaRelay';

vi.mock('./agendaEnMemoria', () => ({
  precargarAgenda: vi.fn(() => Promise.resolve()),
  agendaPorTelefono: vi.fn(() => new Map([['960397018', 'Wilson'], ['902049935', 'Mamá']])),
}));

/** Contacts on the web through the phone (José, 20/10, option «b»). */
describe('answerAgendaRequest', () => {
  it('answers only the numbers asked, with the names of the address book', async () => {
    const emit = vi.fn();
    await answerAgendaRequest({ emit }, { requestId: 'r1', phones: ['960397018', '911111111'] });
    expect(emit).toHaveBeenCalledWith('agenda.respuesta', { requestId: 'r1', nombres: { '960397018': 'Wilson' } });
  });

  it('ignores a request without id or numbers', async () => {
    const emit = vi.fn();
    await answerAgendaRequest({ emit }, { phones: ['960397018'] });
    await answerAgendaRequest({ emit }, { requestId: 'r2', phones: 'x' });
    await answerAgendaRequest({ emit }, undefined);
    expect(emit).not.toHaveBeenCalled();
  });
});

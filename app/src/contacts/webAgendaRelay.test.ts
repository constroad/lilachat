import { describe, expect, it, vi } from 'vitest';
import { answerAgendaRequest, answerFullAgendaRequest } from './webAgendaRelay';

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

/** «Nuevo chat» on the web with the whole address book (pending 20). */
describe('answerFullAgendaRequest', () => {
  it('sends every number with its name, by name', async () => {
    // Arrange
    const emit = vi.fn();
    // Act
    await answerFullAgendaRequest({ emit }, { requestId: 'r3' });
    // Assert
    expect(emit).toHaveBeenCalledWith('agenda.respuestaTodo', { requestId: 'r3', contactos: [{ phone: '902049935', name: 'Mamá' }, { phone: '960397018', name: 'Wilson' }] });
  });

  it('ignores a request without id', async () => {
    const emit = vi.fn();
    await answerFullAgendaRequest({ emit }, {});
    expect(emit).not.toHaveBeenCalled();
  });
});

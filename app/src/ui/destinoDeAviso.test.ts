import { describe, expect, it } from 'vitest';
import { destinoDeAviso } from './destinoDeAviso';

/**
 * Tocar una notificación lleva a lo que avisa (FL8; auditoría 17/10/2026: el
 * `chatId` viajaba en la notificación y nadie escuchaba el toque — se abría la
 * app en la lista, o donde estuviera).
 */
describe('destinoDeAviso', () => {
  it('un mensaje (push o aviso local) abre su chat', () => {
    expect(destinoDeAviso({ chatId: '6a90cf90d2dbc98541f59dd0', seq: '12' })).toEqual({ tipo: 'chat', chatId: '6a90cf90d2dbc98541f59dd0' });
  });

  it('un recordatorio o un evento abre la Agenda, aunque traiga el chat del evento', () => {
    expect(destinoDeAviso({ chatId: '', seq: '0', tipo: 'agenda' })).toEqual({ tipo: 'agenda' });
    expect(destinoDeAviso({ chatId: '6a90cf90d2dbc98541f59dd0', seq: '0', tipo: 'agenda' })).toEqual({ tipo: 'agenda' });
  });

  it('sin chat ni tipo conocido no lleva a ningún lado', () => {
    expect(destinoDeAviso({ chatId: '' })).toBeNull();
    expect(destinoDeAviso({})).toBeNull();
    expect(destinoDeAviso(null)).toBeNull();
    expect(destinoDeAviso('basura')).toBeNull();
  });

  it('un chatId que no es un id de Mongo no se usa (no se navega a cualquier cosa)', () => {
    expect(destinoDeAviso({ chatId: '../../ajustes' })).toBeNull();
  });
});

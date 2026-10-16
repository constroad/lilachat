import { describe, expect, it } from 'vitest';
import { chatAbiertoDe } from './rutas';

describe('chatAbiertoDe', () => {
  it('en la lista no hay chat abierto', () => {
    expect(chatAbiertoDe({ index: 0, routes: [{ name: 'Inicio' }] })).toBeNull();
  });

  it('con un chat arriba devuelve su id', () => {
    const estado = { index: 1, routes: [{ name: 'Inicio' }, { name: 'Chat', params: { chat: { id: 'c1' } } }] };
    expect(chatAbiertoDe(estado)).toBe('c1');
  });

  /** Al volver, el chat sigue en `routes` un instante pero ya no está arriba. */
  it('solo cuenta la pantalla de ARRIBA', () => {
    const estado = { index: 0, routes: [{ name: 'Inicio' }, { name: 'Chat', params: { chat: { id: 'c1' } } }] };
    expect(chatAbiertoDe(estado)).toBeNull();
  });

  it('sin estado (navegador recién montado): nada', () => {
    expect(chatAbiertoDe(undefined)).toBeNull();
  });
});

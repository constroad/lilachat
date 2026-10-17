import { describe, expect, it } from 'vitest';
import { visitadasCon } from './pestanas';

describe('visitadasCon', () => {
  it('suma la pestaña nueva y conserva las anteriores (quedan montadas)', () => {
    expect([...visitadasCon(new Set(['chats']), 'agenda')]).toEqual(['chats', 'agenda']);
  });

  it('volver a una ya visitada no cambia nada: misma referencia, sin render de más', () => {
    const visitadas = new Set(['chats', 'agenda']);
    expect(visitadasCon(visitadas, 'chats')).toBe(visitadas);
  });
});

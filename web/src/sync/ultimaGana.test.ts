import { describe, expect, it } from 'vitest';
import { crearUltimaGana } from './ultimaGana';

describe('crearUltimaGana', () => {
  it('solo la última carga empezada puede escribir', () => {
    const cargas = crearUltimaGana();
    const vieja = cargas.empezar();
    const nueva = cargas.empezar();
    expect(cargas.vigente(vieja)).toBe(false);
    expect(cargas.vigente(nueva)).toBe(true);
  });

  it('un cambio optimista invalida lo que estaba en vuelo (traería el estado de antes)', () => {
    const cargas = crearUltimaGana();
    const enVuelo = cargas.empezar();
    cargas.invalidar();
    expect(cargas.vigente(enVuelo)).toBe(false);
    expect(cargas.vigente(cargas.empezar())).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { ondaDesdeMuestras } from './ondaDeVoz';

/**
 * La onda de la nota de voz (FL9), como WhatsApp: el nivel que se midió al
 * grabar, en barras de 0 a 100. Silencio abajo, la voz arriba.
 */
describe('ondaDesdeMuestras', () => {
  it('-60 dB o menos es silencio (0); 0 dB es el tope (100)', () => {
    expect(ondaDesdeMuestras([-160, -60, -30, 0])).toEqual([0, 0, 50, 100]);
  });

  it('muchas muestras se promedian en la cantidad de barras pedida', () => {
    const onda = ondaDesdeMuestras(Array.from({ length: 80 }, (_, i) => (i < 40 ? -60 : 0)), 40);

    expect(onda).toHaveLength(40);
    expect(onda[0]).toBe(0);
    expect(onda[39]).toBe(100);
  });

  it('sin muestras, sin onda', () => {
    expect(ondaDesdeMuestras([])).toEqual([]);
  });

  it('lo que no es un número no cuenta', () => {
    expect(ondaDesdeMuestras([Number.NaN, -30])).toEqual([50]);
  });
});

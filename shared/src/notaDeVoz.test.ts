import { describe, expect, it } from 'vitest';
import { duracionDeVoz, esVozUsable, MINIMO_DE_VOZ_MS } from './notaDeVoz.js';

describe('duracionDeVoz', () => {
  it('segundos con dos dígitos', () => {
    expect(duracionDeVoz(0)).toBe('0:00');
    expect(duracionDeVoz(7_000)).toBe('0:07');
    expect(duracionDeVoz(65_000)).toBe('1:05');
  });

  it('minutos largos no se cortan', () => {
    expect(duracionDeVoz(605_000)).toBe('10:05');
  });

  /** Redondea hacia abajo: un contador que salta a «0:01» sin haber pasado un
   * segundo se ve adelantado respecto del audio. */
  it('trunca, no redondea', () => {
    expect(duracionDeVoz(1_999)).toBe('0:01');
  });

  it('una duración que no llegó se dice como cero, no como NaN', () => {
    expect(duracionDeVoz(undefined)).toBe('0:00');
    expect(duracionDeVoz(-5)).toBe('0:00');
  });
});

describe('esVozUsable', () => {
  /**
   * **Un toque sin querer no manda una nota de voz.** Sin este mínimo, rozar el
   * micrófono deja un audio de dos décimas en la conversación de todos — y en un
   * grupo eso le suena a cada teléfono.
   */
  it('menos del mínimo no se manda', () => {
    expect(esVozUsable(MINIMO_DE_VOZ_MS - 1)).toBe(false);
    expect(esVozUsable(0)).toBe(false);
  });

  it('desde el mínimo, sí', () => {
    expect(esVozUsable(MINIMO_DE_VOZ_MS)).toBe(true);
    expect(esVozUsable(30_000)).toBe(true);
  });
});

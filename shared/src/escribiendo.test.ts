import { describe, expect, it } from 'vitest';
import { APAGADO_DE_ESCRIBIENDO_MS, REPETIR_ESCRIBIENDO_MS, debeAvisarEscribiendo } from './escribiendo.js';

describe('debeAvisarEscribiendo', () => {
  it('la primera tecla avisa', () => {
    expect(debeAvisarEscribiendo({ ultimoAviso: null, ahora: 1000 })).toBe(true);
  });

  it('las teclas siguientes no repiten el aviso enseguida', () => {
    expect(debeAvisarEscribiendo({ ultimoAviso: 1000, ahora: 2500 })).toBe(false);
  });

  it('escribiendo un párrafo largo, se renueva antes de que el otro lo apague', () => {
    expect(debeAvisarEscribiendo({ ultimoAviso: 1000, ahora: 1000 + REPETIR_ESCRIBIENDO_MS })).toBe(true);
    expect(REPETIR_ESCRIBIENDO_MS).toBeLessThan(APAGADO_DE_ESCRIBIENDO_MS);
  });
});

import { describe, expect, it } from 'vitest';
import { colorDeAutor, mostrarAutor, radiosDeBurbuja, CANTIDAD_DE_COLORES_DE_AUTOR } from './burbuja';

/**
 * FL3 (diseño «Conversación 1:1 · Claro»): radio 18, las consecutivas del mismo
 * autor se agrupan con esquinas internas de 6 y solo la ÚLTIMA lleva la cola.
 */
describe('radiosDeBurbuja', () => {
  it('suelta (sin vecinos del mismo autor): redonda con la cola abajo del lado del autor', () => {
    expect(radiosDeBurbuja({ mia: true, conAnterior: false, conSiguiente: false })).toEqual({
      arribaIzq: 18,
      arribaDer: 18,
      abajoIzq: 18,
      abajoDer: 4,
    });
  });

  it('propia en el medio de un bloque: esquinas internas de su lado en 6, sin cola', () => {
    expect(radiosDeBurbuja({ mia: true, conAnterior: true, conSiguiente: true })).toEqual({
      arribaIzq: 18,
      arribaDer: 6,
      abajoIzq: 18,
      abajoDer: 6,
    });
  });

  it('ajena primera del bloque: arriba redonda, abajo interna (sigue otra)', () => {
    expect(radiosDeBurbuja({ mia: false, conAnterior: false, conSiguiente: true })).toEqual({
      arribaIzq: 18,
      arribaDer: 18,
      abajoIzq: 6,
      abajoDer: 18,
    });
  });

  it('ajena última del bloque: lleva la cola abajo a la izquierda', () => {
    expect(radiosDeBurbuja({ mia: false, conAnterior: true, conSiguiente: false }).abajoIzq).toBe(4);
  });
});

describe('mostrarAutor', () => {
  it('en un grupo, solo la PRIMERA burbuja ajena del bloque lleva el nombre', () => {
    expect(mostrarAutor({ esGrupo: true, mia: false, conAnterior: false })).toBe(true);
    expect(mostrarAutor({ esGrupo: true, mia: false, conAnterior: true })).toBe(false);
  });

  it('nunca en las propias ni en un 1:1', () => {
    expect(mostrarAutor({ esGrupo: true, mia: true, conAnterior: false })).toBe(false);
    expect(mostrarAutor({ esGrupo: false, mia: false, conAnterior: false })).toBe(false);
  });
});

describe('colorDeAutor', () => {
  it('la misma persona tiene siempre el mismo color', () => {
    expect(colorDeAutor('665f1a2b3c4d5e6f70818293')).toBe(colorDeAutor('665f1a2b3c4d5e6f70818293'));
  });

  it('está dentro de la paleta', () => {
    for (const id of ['a', '665f1a2b3c4d5e6f70818294', 'zzzzzz']) {
      const indice = colorDeAutor(id);
      expect(indice).toBeGreaterThanOrEqual(1);
      expect(indice).toBeLessThanOrEqual(CANTIDAD_DE_COLORES_DE_AUTOR);
    }
  });

  it('reparte: varias personas no caen todas en el mismo color', () => {
    const ids = ['665f1a2b3c4d5e6f70818291', '665f1a2b3c4d5e6f70818292', '665f1a2b3c4d5e6f70818293', '665f1a2b3c4d5e6f70818294'];
    expect(new Set(ids.map(colorDeAutor)).size).toBeGreaterThan(1);
  });
});

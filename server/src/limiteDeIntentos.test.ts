import { describe, expect, it } from 'vitest';
import { crearLimiteDeIntentos } from './limiteDeIntentos.js';

describe('límite de intentos por clave', () => {
  it('deja pasar hasta el máximo por ventana y se libera al pasar la ventana', () => {
    let ahora = 0;
    const limite = crearLimiteDeIntentos({ maximo: 2, ventanaMs: 60_000, ahora: () => ahora });
    expect([limite.permitir('ip-a'), limite.permitir('ip-a'), limite.permitir('ip-a')]).toEqual([true, true, false]);
    expect(limite.permitir('ip-b')).toBe(true);
    ahora = 60_001;
    expect(limite.permitir('ip-a')).toBe(true);
  });

  it('olvida las claves viejas: la memoria no crece con cada IP que pasó', () => {
    let ahora = 0;
    const limite = crearLimiteDeIntentos({ maximo: 1, ventanaMs: 1_000, ahora: () => ahora });
    for (let indice = 0; indice < 50; indice += 1) limite.permitir(`ip-${indice}`);
    ahora = 2_000;
    limite.permitir('otra');
    expect(limite.claves()).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { mostrarSinConexion } from './conexion';

describe('mostrarSinConexion', () => {
  it('sin red, se dice enseguida', () => {
    expect(mostrarSinConexion({ enLinea: false, socketConectado: false, sinSocketDesdeMs: 0, ahora: 0 })).toBe(true);
  });

  it('con red y socket, nada', () => {
    expect(mostrarSinConexion({ enLinea: true, socketConectado: true, sinSocketDesdeMs: null, ahora: 10_000 })).toBe(false);
  });

  it('un corte del socket de un par de segundos (reconexión) no asusta a nadie', () => {
    expect(mostrarSinConexion({ enLinea: true, socketConectado: false, sinSocketDesdeMs: 1000, ahora: 3000 })).toBe(false);
  });

  it('sin socket por más de 5 s con «red», sí: el server no contesta', () => {
    expect(mostrarSinConexion({ enLinea: true, socketConectado: false, sinSocketDesdeMs: 1000, ahora: 7000 })).toBe(true);
  });
});

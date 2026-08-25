import { describe, expect, it } from 'vitest';
import { margenInferior, margenSuperior } from './margenes';

/**
 * Cuánto aire hay que dejar arriba y abajo para no pelear con el sistema.
 *
 * Existe por lo que vio José el 25/08/2026 en su Android: el botón «Continuar»
 * de la pantalla de acceso quedaba **debajo de la barra de tres botones** de
 * Samsung. La app no usaba safe area en ninguna pantalla: todas tenían un
 * `pb-8` (32 px) escrito a mano, que en un teléfono con barra de gestos alcanza
 * y con barra de botones (48 px) no.
 *
 * La regla es un máximo, no una suma: el inset YA incluye el alto de la barra, y
 * sumarle el margen de diseño deja un hueco enorme en los teléfonos donde el
 * inset es grande.
 */
describe('margenInferior', () => {
  it('con barra de botones manda el inset', () => {
    expect(margenInferior(48)).toBe(48);
  });

  /** Barra de gestos: el inset es chico y el que manda es el margen de diseño. */
  it('con barra de gestos manda el diseño', () => {
    expect(margenInferior(16)).toBe(24);
  });

  /** Sin inset (o si el proveedor todavía no midió) igual queda aire. */
  it('sin inset queda el mínimo del diseño', () => {
    expect(margenInferior(0)).toBe(24);
  });

  /**
   * Un inset absurdo no se propaga: una medición rara no puede dejar el botón
   * a mitad de pantalla.
   */
  it('un inset disparatado se acota', () => {
    expect(margenInferior(400)).toBe(64);
  });

  it('un inset negativo se ignora', () => {
    expect(margenInferior(-10)).toBe(24);
  });
});

describe('margenSuperior', () => {
  it('la barra de estado manda cuando es alta', () => {
    expect(margenSuperior(54)).toBe(54);
  });

  /**
   * Sin inset queda el mínimo. Antes las pantallas usaban `pt-14` (56 px) fijo,
   * que en un teléfono con isla o cámara perforada tapaba el título.
   */
  it('sin inset queda el mínimo del diseño', () => {
    expect(margenSuperior(0)).toBe(20);
  });

  it('un inset disparatado se acota', () => {
    expect(margenSuperior(500)).toBe(80);
  });
});

import { describe, expect, it } from 'vitest';
import { ZOOM_DOBLE_TOQUE, ZOOM_MAXIMO, debeCerrar, desplazamientoPermitido, indiceDeFoto, zoomAcotado, zoomDelDobleToque } from './visor';

/**
 * El visor a lo WhatsApp (José, 17/10/2026: «cuando abro una imagen y deslizo
 * con los dedos no pasa a la previa o la siguiente»). Lo que se decide con
 * números vive acá; el componente solo mueve.
 */
describe('indiceDeFoto', () => {
  const lista = [{ seq: 3 }, { seq: 7 }, { seq: 12 }];

  it('ubica la foto por su seq, no por la posición', () => {
    expect(indiceDeFoto(lista, 7)).toBe(1);
  });

  it('una foto que ya no está (borrada) cae a la última, no a -1', () => {
    expect(indiceDeFoto(lista, 99)).toBe(2);
    expect(indiceDeFoto([], 5)).toBe(0);
  });
});

describe('debeCerrar', () => {
  it('cierra al soltar después de bajar lo suficiente', () => {
    expect(debeCerrar({ dy: 160, vy: 0 })).toBe(true);
  });

  it('cierra con un tirón rápido aunque se haya movido poco', () => {
    expect(debeCerrar({ dy: 40, vy: 1400 })).toBe(true);
  });

  it('un movimiento corto y lento vuelve a su lugar', () => {
    expect(debeCerrar({ dy: 60, vy: 200 })).toBe(false);
  });

  it('hacia ARRIBA también cierra, como WhatsApp', () => {
    expect(debeCerrar({ dy: -170, vy: 0 })).toBe(true);
  });
});

describe('zoom', () => {
  it('no se achica por debajo del tamaño real ni pasa del máximo', () => {
    expect(zoomAcotado(0.4)).toBe(1);
    expect(zoomAcotado(9)).toBe(ZOOM_MAXIMO);
    expect(zoomAcotado(2.2)).toBe(2.2);
  });

  it('el doble toque alterna: sin zoom acerca, con zoom vuelve', () => {
    expect(zoomDelDobleToque(1)).toBe(ZOOM_DOBLE_TOQUE);
    expect(zoomDelDobleToque(1.05)).toBe(ZOOM_DOBLE_TOQUE);
    expect(zoomDelDobleToque(2.7)).toBe(1);
  });

  /** Con zoom 2 la imagen mide el doble: se puede correr media pantalla para cada lado y no más. */
  it('el desplazamiento con zoom no deja ver el negro de afuera', () => {
    expect(desplazamientoPermitido({ desplazamiento: 500, zoom: 2, lado: 400 })).toBe(200);
    expect(desplazamientoPermitido({ desplazamiento: -500, zoom: 2, lado: 400 })).toBe(-200);
    expect(desplazamientoPermitido({ desplazamiento: 50, zoom: 2, lado: 400 })).toBe(50);
    expect(desplazamientoPermitido({ desplazamiento: 80, zoom: 1, lado: 400 })).toBe(0);
  });
});

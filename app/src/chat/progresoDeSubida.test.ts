import { describe, expect, it } from 'vitest';
import { porcentajeDeSubida, textoDeSubida } from './progresoDeSubida';

describe('porcentajeDeSubida', () => {
  it('convierte la razón a porcentaje', () => {
    expect(porcentajeDeSubida(0.5)).toBe(50);
    expect(porcentajeDeSubida(0.337)).toBe(34);
  });

  /**
   * **El «199 %» que reportó José (27/08/2026).**
   *
   * `XMLHttpRequest.upload` de React Native reporta un `loaded` que no cuadra
   * con su `total` en un multipart, y la razón se pasa de 1. Antes que adivinar
   * la fórmula del bindeo nativo —que cambia entre versiones— se acota: lo que
   * sube está entre 0 y 100 y punto.
   */
  it('nunca pasa de 100', () => {
    expect(porcentajeDeSubida(1.99)).toBe(100);
    expect(porcentajeDeSubida(12)).toBe(100);
  });

  it('nunca baja de 0', () => {
    expect(porcentajeDeSubida(-0.4)).toBe(0);
  });

  /**
   * `total` en cero da `NaN` o `Infinity` según el `loaded`. Los dos significan
   * lo mismo: **no se sabe cuánto pesa**, que NO es lo mismo que estar
   * terminado. Se muestra 0 — decir 100 sería exactamente la mentira que este
   * módulo existe para evitar.
   */
  it('un tamaño desconocido no se pinta como completo', () => {
    expect(porcentajeDeSubida(NaN)).toBe(0);
    expect(porcentajeDeSubida(Infinity)).toBe(0);
  });
});

describe('textoDeSubida', () => {
  it('dice cuánto va mientras sube', () => {
    expect(textoDeSubida(0.42)).toBe('Enviando… 42%');
  });

  /**
   * Al 100 cambia de frase. Los últimos bytes llegan bastante antes de que el
   * server conteste, y un «100 %» quieto varios segundos se lee como colgado.
   */
  it('al terminar de subir dice que está procesando', () => {
    expect(textoDeSubida(1)).toBe('Procesando…');
    expect(textoDeSubida(1.99)).toBe('Procesando…');
  });
});

import { describe, expect, it } from 'vitest';
import { anilloDeSubida, etiquetaDeSubida, porcentajeDeSubida, textoDeSubida, valeAvisarProgreso } from './progresoDeSubida';

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

/**
 * Un archivo que no se va a subir no dice «Enviando… 0%» con la ruedita
 * (FL8; E2E del 17/10/2026: fallido y girando a la vez, con el «No se envió»
 * debajo).
 */
describe('etiquetaDeSubida', () => {
  it('subiendo: el texto de siempre y la ruedita', () => {
    expect(etiquetaDeSubida({ razon: 0.42, fallido: false })).toEqual({ texto: 'Enviando… 42%', girando: true });
  });

  it('fallido: lo dice y deja de girar, con cualquier progreso', () => {
    expect(etiquetaDeSubida({ razon: 0, fallido: true })).toEqual({ texto: 'No se envió', girando: false });
    expect(etiquetaDeSubida({ razon: 0.8, fallido: true })).toEqual({ texto: 'No se envió', girando: false });
  });
});

/**
 * FL12 (§49 #11): cada `onprogress` del XHR redibujaba la pantalla entera,
 * ~10 veces por segundo mientras subía una foto. Se avisa por pasos visibles.
 */
describe('valeAvisarProgreso', () => {
  it('un paso chico no avisa; uno visible sí', () => {
    expect(valeAvisarProgreso(0.1, 0.11)).toBe(false);
    expect(valeAvisarProgreso(0.1, 0.15)).toBe(true);
  });

  it('el primero y el final siempre avisan', () => {
    expect(valeAvisarProgreso(null, 0.01)).toBe(true);
    expect(valeAvisarProgreso(0.99, 1)).toBe(true);
  });
});

/** Auditoría (19/10): un anillo sobre la foto, como WhatsApp, en vez de «Enviando… 37%» dos veces. */
describe('anilloDeSubida', () => {
  it('mientras sube, la fracción acotada', () => {
    expect(anilloDeSubida(0.37)).toEqual({ fraccion: 0.37, girando: false });
    expect(anilloDeSubida(1.99)).toEqual({ fraccion: 1, girando: true });
  });

  it('sin medir todavía, gira (no dice 0 % para siempre)', () => {
    expect(anilloDeSubida(Number.NaN)).toEqual({ fraccion: 0, girando: true });
    expect(anilloDeSubida(0)).toEqual({ fraccion: 0, girando: true });
  });
});

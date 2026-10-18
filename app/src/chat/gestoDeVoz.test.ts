import { describe, expect, it } from 'vitest';
import { decidirAlSoltar, mientrasSostiene, UMBRAL_BLOQUEO, UMBRAL_CANCELAR } from './gestoDeVoz';

/**
 * El micrófono como WhatsApp (FL9) sin perder lo de antes: sostener y soltar
 * manda; deslizar a la izquierda cancela; hacia arriba bloquea; y un toque
 * corto sigue siendo «grabar sin manos», que es como andaba hasta ahora.
 */
describe('decidirAlSoltar', () => {
  it('sostenido y soltado en el lugar: se manda', () => {
    expect(decidirAlSoltar({ dx: -10, dy: 5, ms: 2500 })).toBe('enviar');
  });

  it('deslizado a la izquierda: se cancela, aunque haya sido largo', () => {
    expect(decidirAlSoltar({ dx: -UMBRAL_CANCELAR - 1, dy: 0, ms: 5000 })).toBe('cancelar');
  });

  it('deslizado hacia arriba: queda bloqueada, grabando sin el dedo', () => {
    expect(decidirAlSoltar({ dx: 0, dy: -UMBRAL_BLOQUEO - 1, ms: 1500 })).toBe('bloquear');
  });

  it('un toque corto: grabar sin manos, como antes', () => {
    expect(decidirAlSoltar({ dx: 0, dy: 0, ms: 150 })).toBe('bloquear');
  });

  it('cancelar gana a bloquear si se fue para los dos lados', () => {
    expect(decidirAlSoltar({ dx: -UMBRAL_CANCELAR - 5, dy: -UMBRAL_BLOQUEO - 5, ms: 1000 })).toBe('cancelar');
  });
});

describe('mientrasSostiene', () => {
  it('avisa qué pasaría al soltar', () => {
    expect(mientrasSostiene({ dx: 0, dy: 0 })).toBe('normal');
    expect(mientrasSostiene({ dx: -UMBRAL_CANCELAR - 1, dy: 0 })).toBe('cancelaria');
    expect(mientrasSostiene({ dx: 0, dy: -UMBRAL_BLOQUEO - 1 })).toBe('bloquearia');
  });
});

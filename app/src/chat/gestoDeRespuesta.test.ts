import { describe, expect, it } from 'vitest';
import { cruzoElUmbral, desplazamientoVisible, MAX_DESPLAZAMIENTO, UMBRAL_RESPUESTA } from './gestoDeRespuesta';

describe('deslizar para responder', () => {
  it('solo se mueve a la derecha', () => {
    expect(desplazamientoVisible(-30)).toBe(0);
  });

  it('tiene tope: la burbuja no se va de la pantalla', () => {
    expect(desplazamientoVisible(400)).toBe(MAX_DESPLAZAMIENTO);
  });

  it('responde recién al cruzar el umbral', () => {
    expect(cruzoElUmbral(UMBRAL_RESPUESTA - 1)).toBe(false);
    expect(cruzoElUmbral(UMBRAL_RESPUESTA)).toBe(true);
  });
});

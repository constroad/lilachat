import { describe, expect, it } from 'vitest';
import { esMiniaturaCompacta } from './vistaPrevia.js';

describe('esMiniaturaCompacta', () => {
  it('un logo o una foto de perfil (cuadrada) va chica al costado, como WhatsApp', () => {
    expect(esMiniaturaCompacta({ ancho: 100, alto: 100 })).toBe(true);
    expect(esMiniaturaCompacta({ ancho: 720, alto: 720 })).toBe(true);
  });

  it('una foto ancha (el og:image de 1.91:1) va grande arriba', () => {
    expect(esMiniaturaCompacta({ ancho: 1200, alto: 630 })).toBe(false);
    expect(esMiniaturaCompacta({ ancho: 480, alto: 360 })).toBe(false);
  });

  it('un video va siempre grande, con el play encima, aunque su miniatura sea cuadrada', () => {
    expect(esMiniaturaCompacta({ ancho: 720, alto: 720, video: true })).toBe(false);
  });

  it('sin medidas (la imagen todavía no cargó) no se decide compacta', () => {
    expect(esMiniaturaCompacta({ ancho: 0, alto: 0 })).toBe(false);
    expect(esMiniaturaCompacta({ ancho: 300, alto: 0 })).toBe(false);
  });
});

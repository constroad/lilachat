import { describe, expect, it } from 'vitest';
import { CALIDAD_JPEG, LADO_MAXIMO, nombreComprimido, planDeCompresion } from './compresionDeFoto.js';

/** José, 19/10: «sí, comprime» (como WhatsApp, con «HD» para mandar la original). */
describe('planDeCompresion', () => {
  it('una foto de cámara apaisada baja a 1600 de ancho, en JPEG', () => {
    expect(planDeCompresion({ width: 4000, height: 3000, mimeType: 'image/jpeg', hd: false })).toEqual({ redimension: { width: LADO_MAXIMO }, calidad: CALIDAD_JPEG });
  });

  it('una vertical baja por el alto', () => {
    expect(planDeCompresion({ width: 3000, height: 4000, mimeType: 'image/heic', hd: false })).toEqual({ redimension: { height: LADO_MAXIMO }, calidad: CALIDAD_JPEG });
  });

  it('una chica no se agranda: solo se recomprime', () => {
    expect(planDeCompresion({ width: 800, height: 600, mimeType: 'image/png', hd: false })).toEqual({ redimension: null, calidad: CALIDAD_JPEG });
  });

  it('sin medidas, se recomprime sin tocar el tamaño', () => {
    expect(planDeCompresion({ mimeType: 'image/jpeg', hd: false })).toEqual({ redimension: null, calidad: CALIDAD_JPEG });
  });

  it('con «HD», videos, GIF y archivos van como están', () => {
    expect(planDeCompresion({ width: 4000, height: 3000, mimeType: 'image/jpeg', hd: true })).toBeNull();
    expect(planDeCompresion({ width: 1920, height: 1080, mimeType: 'video/mp4', hd: false })).toBeNull();
    expect(planDeCompresion({ width: 500, height: 500, mimeType: 'image/gif', hd: false })).toBeNull();
    expect(planDeCompresion({ mimeType: 'application/pdf', hd: false })).toBeNull();
  });
});

describe('nombreComprimido', () => {
  it('cambia la extensión a .jpg', () => {
    expect(nombreComprimido('IMG_2041.HEIC')).toBe('IMG_2041.jpg');
    expect(nombreComprimido('captura.png')).toBe('captura.jpg');
    expect(nombreComprimido('sin-extension')).toBe('sin-extension.jpg');
    expect(nombreComprimido('.png')).toBe('foto.jpg');
  });
});

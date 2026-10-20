import { describe, expect, it } from 'vitest';
import { alternarDestacado, textoDelDestacado } from './destacados.js';

/** «Destacados» (José aprobó el 20/10): la estrella personal. */
describe('textoDelDestacado', () => {
  it('el texto tal cual; lo que no es texto, con su etiqueta', () => {
    expect(textoDelDestacado({ kind: 'text', body: 'Plano final' })).toBe('Plano final');
    expect(textoDelDestacado({ kind: 'image', media: { mime: 'image/jpeg' } })).toBe('📷 Foto');
    expect(textoDelDestacado({ kind: 'image', body: 'La losa', media: { mime: 'image/jpeg' } })).toBe('📷 La losa');
    expect(textoDelDestacado({ kind: 'audio', media: { mime: 'audio/m4a' } })).toBe('🎤 Nota de voz');
    expect(textoDelDestacado({ kind: 'file', media: { mime: 'application/pdf', fileName: 'plano.pdf' } })).toBe('📎 plano.pdf');
    expect(textoDelDestacado({ kind: 'poll', body: '📊 ¿Qué llevamos?', ref: { tipo: 'encuesta', id: 'p1' } })).toBe('📊 ¿Qué llevamos?');
  });
});

describe('alternarDestacado', () => {
  it('suma si no está y lo saca si está, sin mutar', () => {
    const antes = [1, 4];
    expect(alternarDestacado(antes, 7)).toEqual([1, 4, 7]);
    expect(alternarDestacado(antes, 4)).toEqual([1]);
    expect(antes).toEqual([1, 4]);
  });
});

import { describe, expect, it } from 'vitest';
import { subtituloDelChat } from './cabeceraDelChat';

const nombres = new Map([
  ['yo', 'José'],
  ['m', 'Mamá'],
  ['p', 'Papá'],
  ['w', 'Wilson'],
]);

/**
 * El subtítulo de la cabecera (FL3, diseño «Conversación de grupo · Oscuro»):
 * en un grupo dice QUIÉN escribe, y si nadie escribe, quiénes están.
 */
describe('subtituloDelChat', () => {
  it('1:1: «escribiendo…» y «en línea», como antes', () => {
    expect(subtituloDelChat({ esGrupo: false, escriben: ['w'], otroEnLinea: false, nombres, yo: 'yo' })).toBe('escribiendo…');
    expect(subtituloDelChat({ esGrupo: false, escriben: [], otroEnLinea: true, nombres, yo: 'yo' })).toBe('en línea');
    expect(subtituloDelChat({ esGrupo: false, escriben: [], otroEnLinea: false, nombres, yo: 'yo' })).toBe('');
  });

  it('grupo: nombra a quien escribe', () => {
    expect(subtituloDelChat({ esGrupo: true, escriben: ['m'], otroEnLinea: false, nombres, yo: 'yo' })).toBe(
      'Mamá está escribiendo…'
    );
  });

  it('grupo: dos o más escriben a la vez', () => {
    expect(subtituloDelChat({ esGrupo: true, escriben: ['m', 'p'], otroEnLinea: false, nombres, yo: 'yo' })).toBe(
      'Mamá y Papá están escribiendo…'
    );
  });

  it('grupo sin nadie escribiendo: los miembros, con «Tú» al final', () => {
    expect(subtituloDelChat({ esGrupo: true, escriben: [], otroEnLinea: false, nombres, yo: 'yo' })).toBe(
      'Mamá, Papá, Wilson, Tú'
    );
  });

  it('grupo sin nombres cargados (sin red): no inventa nada', () => {
    expect(subtituloDelChat({ esGrupo: true, escriben: ['m'], otroEnLinea: false, nombres: new Map(), yo: 'yo' })).toBe(
      'alguien está escribiendo…'
    );
    expect(subtituloDelChat({ esGrupo: true, escriben: [], otroEnLinea: false, nombres: new Map(), yo: 'yo' })).toBe('');
  });
});

/** «últ. vez» (FL10): en un 1:1 fuera de línea, cuándo se lo vio por última vez. */
describe('subtituloDelChat — últ. vez', () => {
  const base = { esGrupo: false, escriben: [], otroEnLinea: false, nombres, yo: 'yo' };
  const ahora = new Date('2026-10-18T15:00:00');
  const ultimaVez = new Date('2026-10-18T07:31:00').toISOString();

  it('fuera de línea, con la última vez conocida', () => {
    expect(subtituloDelChat({ ...base, ultimaVez, ahora })).toMatch(/^últ\. vez hoy a las /);
  });

  it('«en línea» y «escribiendo…» le ganan', () => {
    expect(subtituloDelChat({ ...base, otroEnLinea: true, ultimaVez, ahora })).toBe('en línea');
    expect(subtituloDelChat({ ...base, escriben: ['w'], ultimaVez, ahora })).toBe('escribiendo…');
  });

  it('en un grupo no hay última vez', () => {
    expect(subtituloDelChat({ ...base, esGrupo: true, nombres: new Map(), ultimaVez, ahora })).toBe('');
  });
});

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

  it('grupo sin nadie escribiendo: los miembros, con «Vos» al final', () => {
    expect(subtituloDelChat({ esGrupo: true, escriben: [], otroEnLinea: false, nombres, yo: 'yo' })).toBe(
      'Mamá, Papá, Wilson, Vos'
    );
  });

  it('grupo sin nombres cargados (sin red): no inventa nada', () => {
    expect(subtituloDelChat({ esGrupo: true, escriben: ['m'], otroEnLinea: false, nombres: new Map(), yo: 'yo' })).toBe(
      'alguien está escribiendo…'
    );
    expect(subtituloDelChat({ esGrupo: true, escriben: [], otroEnLinea: false, nombres: new Map(), yo: 'yo' })).toBe('');
  });
});

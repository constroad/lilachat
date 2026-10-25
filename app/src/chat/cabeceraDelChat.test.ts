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
  it('online with a chosen status says it, like «ausente» or «ocupado» (pending 15)', () => {
    // Arrange / Act / Assert
    expect(subtituloDelChat({ esGrupo: false, escriben: [], otroEnLinea: true, otroEstado: 'busy', nombres, yo: 'yo' })).toBe('ocupado');
    expect(subtituloDelChat({ esGrupo: false, escriben: [], otroEnLinea: true, otroEstado: 'away', nombres, yo: 'yo' })).toBe('ausente');
    expect(subtituloDelChat({ esGrupo: false, escriben: ['w'], otroEnLinea: true, otroEstado: 'busy', nombres, yo: 'yo' })).toBe('escribiendo…');
  });

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
    expect(subtituloDelChat({ ...base, ultimaVez, ahora })).toMatch(/^últ\. vez \d{1,2}:\d{2}/);
  });

  it('«en línea» y «escribiendo…» le ganan', () => {
    expect(subtituloDelChat({ ...base, otroEnLinea: true, ultimaVez, ahora })).toBe('en línea');
    expect(subtituloDelChat({ ...base, escriben: ['w'], ultimaVez, ahora })).toBe('escribiendo…');
  });

  it('en un grupo no hay última vez', () => {
    expect(subtituloDelChat({ ...base, esGrupo: true, nombres: new Map(), ultimaVez, ahora })).toBe('');
  });
});

/**
 * José, 25/10/2026: with many people in a group or channel, every member showed in the header in small type and
 * it looked terrible; do it like WhatsApp and Slack.
 */
describe('subtituloDelChat — many miembros', () => {
  const base = { esGrupo: true, escriben: [], otroEnLinea: false, yo: 'yo' };
  const many = new Map([
    ['yo', 'José'],
    ['a', 'Ana'],
    ['b', 'Beto'],
    ['c', 'Carla'],
    ['d', 'Diego'],
    ['e', 'Elena'],
  ]);

  it('WhatsApp: con más de tres, nombra a tres y cuenta al resto en vez de listar a todos', () => {
    expect(subtituloDelChat({ ...base, nombres: many })).toBe('Ana, Beto, Carla y 2 más');
  });

  it('WhatsApp: con uno solo de más dice «y 1 más»', () => {
    const four = new Map([...many].slice(0, 5));
    expect(subtituloDelChat({ ...base, nombres: four })).toBe('Ana, Beto, Carla y 1 más');
  });

  it('Slack (modo lista): cuenta los miembros, sin nombrarlos', () => {
    expect(subtituloDelChat({ ...base, nombres: many, listMode: true })).toBe('6 miembros');
  });

  it('Slack: un miembro es singular y sin nadie cargado no inventa nada', () => {
    expect(subtituloDelChat({ ...base, nombres: new Map([['yo', 'José']]), listMode: true })).toBe('1 miembro');
    expect(subtituloDelChat({ ...base, nombres: new Map(), listMode: true })).toBe('');
  });

  it('Slack: usa el total que el server informa cuando es mayor a los nombres cargados', () => {
    expect(subtituloDelChat({ ...base, nombres: many, listMode: true, totalMembers: 40 })).toBe('40 miembros');
  });

  it('Slack: quien escribe sigue ganándole a la cuenta', () => {
    expect(subtituloDelChat({ ...base, nombres: many, listMode: true, escriben: ['a'] })).toBe('Ana está escribiendo…');
  });
});

import { describe, expect, it } from 'vitest';
import { mentionOptions } from '@lilachat/shared';
import { filtrarMencionables } from './SugerenciasDeMencion';

const miembros = [
  { id: '1', nombre: 'Ana López' },
  { id: '2', nombre: 'Mariana' },
  { id: '3', nombre: 'José' },
];

describe('filtrarMencionables', () => {
  it('los que empiezan con lo escrito van primero', () => {
    expect(filtrarMencionables(miembros, 'an').map((m) => m.id)).toEqual(['1', '2']);
  });

  it('sin tildes: «jose» encuentra a José', () => {
    expect(filtrarMencionables(miembros, 'jose').map((m) => m.id)).toEqual(['3']);
  });

  it('con solo el «@», todos', () => {
    expect(filtrarMencionables(miembros, '')).toHaveLength(3);
  });
});

/** E3b (20/10): in a group the group mentions come first and match without the accent. */
describe('group mentions in the suggestions', () => {
  it('«@a» offers @aquí before Ana; «@to» offers @todos', () => {
    const options = mentionOptions([{ id: 'ana', nombre: 'Ana Torres' }, { id: 'beto', nombre: 'Beto' }])!;
    expect(filtrarMencionables(options, 'a').map((option) => option.nombre)).toEqual(['aquí', 'Ana Torres']);
    expect(filtrarMencionables(options, 'to').map((option) => option.id)).toEqual(['todos', 'ana', 'beto']);
  });
});

/** José 25/10: «puse @ y ni me salieron todos los miembros del canal». */
describe('a whole space in the list', () => {
  const people = Array.from({ length: 30 }, (_, index) => ({ id: `u${index}`, nombre: `Persona ${String(index).padStart(2, '0')}` }));

  it('«@» alone lists everyone, not just the first few', () => {
    expect(filtrarMencionables(people, '')).toHaveLength(30);
  });

  it('whoever is in the chat comes before whoever is only in the space', () => {
    const mixed = [
      { id: 'out', nombre: 'Ana Fuera', outsideChat: true },
      { id: 'in', nombre: 'Mariana Dentro' },
      { id: 'in2', nombre: 'Anabel Dentro' },
    ];
    expect(filtrarMencionables(mixed, 'an').map((one) => one.id)).toEqual(['in2', 'in', 'out']);
  });
});

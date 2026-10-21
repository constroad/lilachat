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

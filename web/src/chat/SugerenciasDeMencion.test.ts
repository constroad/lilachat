import { describe, expect, it } from 'vitest';
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

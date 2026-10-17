import { describe, expect, it } from 'vitest';
import { acuseDelGrupo } from './acuses.js';

/**
 * El check azul en un grupo (FL8; auditoría 17/10/2026): «leído» solo cuando
 * lo leyeron TODOS. La app tomaba el acuse de cualquiera (se ponía azul con el
 * primero) y el server ignoraba a quien nunca había abierto el chat.
 */
describe('acuseDelGrupo', () => {
  const porMiembro = (pares: [string, number][]) => new Map(pares);

  it('manda el MENOR: azul solo cuando lo leyeron todos', () => {
    expect(acuseDelGrupo({ otros: ['ana', 'luis'], porMiembro: porMiembro([['ana', 10], ['luis', 7]]) })).toBe(7);
  });

  it('quien nunca abrió el chat cuenta como 0, no se ignora', () => {
    expect(acuseDelGrupo({ otros: ['ana', 'luis'], porMiembro: porMiembro([['ana', 10]]) })).toBe(0);
  });

  it('en la app, el que no mandó acuse en vivo vale la base que dio el server', () => {
    expect(acuseDelGrupo({ otros: ['ana', 'luis'], porMiembro: porMiembro([['ana', 12]]), base: 9 })).toBe(9);
    expect(acuseDelGrupo({ otros: ['ana', 'luis'], porMiembro: porMiembro([['ana', 12], ['luis', 11]]), base: 9 })).toBe(11);
  });

  it('nunca retrocede de la base', () => {
    expect(acuseDelGrupo({ otros: ['ana'], porMiembro: porMiembro([['ana', 3]]), base: 9 })).toBe(9);
  });

  it('en un 1:1 es el acuse del otro', () => {
    expect(acuseDelGrupo({ otros: ['ana'], porMiembro: porMiembro([['ana', 15]]) })).toBe(15);
  });

  it('sin nadie que acuse (solo yo, o solo Lila): la base', () => {
    expect(acuseDelGrupo({ otros: [], porMiembro: porMiembro([]), base: 4 })).toBe(4);
    expect(acuseDelGrupo({ otros: [], porMiembro: porMiembro([]) })).toBe(0);
  });
});

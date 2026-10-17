import { describe, expect, it } from 'vitest';
import { MAX_NOMBRE_DE_PERFIL, validarNombreDePerfil } from './perfil.js';

/** El nombre del perfil (FL9): lo que ven los que no te tienen agendado. */
describe('validarNombreDePerfil', () => {
  it('recorta los bordes y junta los espacios de adentro', () => {
    expect(validarNombreDePerfil('  José   Zamora ')).toEqual({ ok: true, nombre: 'José Zamora' });
  });

  it('vacío o de espacios: no hay nombre', () => {
    expect(validarNombreDePerfil('   ').ok).toBe(false);
  });

  it(`más de ${MAX_NOMBRE_DE_PERFIL} letras: se rechaza, no se corta a escondidas`, () => {
    expect(validarNombreDePerfil('a'.repeat(MAX_NOMBRE_DE_PERFIL)).ok).toBe(true);
    expect(validarNombreDePerfil('a'.repeat(MAX_NOMBRE_DE_PERFIL + 1)).ok).toBe(false);
  });

  it('cuenta letras y no unidades de UTF-16 (un emoji vale uno)', () => {
    expect(validarNombreDePerfil(`${'a'.repeat(MAX_NOMBRE_DE_PERFIL - 1)}🙂`).ok).toBe(true);
  });

  it('lo que no es texto no es un nombre', () => {
    expect(validarNombreDePerfil(42).ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { groupContactsByLetter, sameMembers, type Contact } from './contacts.js';

/**
 * La lista de contactos del diseño «New Group»: agrupada por letra, con una
 * cabecera por grupo.
 */
const contacto = (name: string, id = name): Contact => ({ id, name, phone: '900000000' });

describe('groupContactsByLetter', () => {
  it('agrupa por inicial y ordena las letras', () => {
    const grupos = groupContactsByLetter([
      contacto('Sarah'),
      contacto('Alice'),
      contacto('Charles'),
    ]);

    expect(grupos.map((grupo) => grupo.letter)).toEqual(['A', 'C', 'S']);
    expect(grupos[0]?.contacts[0]?.name).toBe('Alice');
  });

  it('dentro de cada letra van alfabéticos', () => {
    const grupos = groupContactsByLetter([contacto('Ana'), contacto('Alberto')]);

    expect(grupos[0]?.contacts.map((item) => item.name)).toEqual(['Alberto', 'Ana']);
  });

  /**
   * Las tildes NO abren un grupo aparte. «Álvaro» y «Ana» van los dos bajo la
   * A: una lista con una sección «Á» con una sola persona se lee como un error.
   */
  it('las tildes caen en la letra sin tilde', () => {
    const grupos = groupContactsByLetter([contacto('Álvaro'), contacto('Ana')]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.letter).toBe('A');
  });

  /** Quien no tiene nombre se agrupa aparte, no bajo una letra inventada. */
  it('sin nombre va al final, bajo #', () => {
    const grupos = groupContactsByLetter([
      { id: '1', name: null, phone: '902049935' },
      contacto('Ana'),
    ]);

    expect(grupos.map((grupo) => grupo.letter)).toEqual(['A', '#']);
    expect(grupos[1]?.contacts[0]?.phone).toBe('902049935');
  });

  it('sin contactos devuelve lista vacía', () => {
    expect(groupContactsByLetter([])).toEqual([]);
  });
});

describe('sameMembers', () => {
  /**
   * Es lo que evita el chat 1:1 DUPLICADO.
   *
   * Sin esto, tocar a la misma persona dos veces desde «nuevo chat» crea dos
   * conversaciones con ella: los mensajes quedan repartidos entre las dos y no
   * hay forma de juntarlas después.
   */
  it('el mismo par en distinto orden es el mismo chat', () => {
    expect(sameMembers(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  it('un tercero lo vuelve otro chat', () => {
    expect(sameMembers(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
  });

  it('repetidos no cambian el conjunto', () => {
    expect(sameMembers(['a', 'a', 'b'], ['b', 'a'])).toBe(true);
  });

  it('conjuntos distintos del mismo tamaño no coinciden', () => {
    expect(sameMembers(['a', 'b'], ['a', 'c'])).toBe(false);
  });
});

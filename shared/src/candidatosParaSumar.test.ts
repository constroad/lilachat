import { describe, expect, it } from 'vitest';
import { candidatosParaSumar } from './candidatosParaSumar.js';
import { groupContactsByLetter, type Contact } from './contacts.js';

const c = (id: string, name: string, phone: string): Contact => ({ id, name, phone });

const wilson = c('u1', 'Wilson', '960397018');
const ana = c('u2', 'Ana', '999111222');
const beto = c('u3', 'Beto', '988777666');

describe('candidatosParaSumar', () => {
  it('saca de la lista a quien ya está en el grupo', () => {
    const r = candidatosParaSumar({
      registrados: groupContactsByLetter([wilson, ana, beto]),
      yaEstan: ['u1'],
    });

    expect(r.paraSumar.flatMap((g) => g.contacts).map((uno) => uno.id)).toEqual(['u2', 'u3']);
  });

  /**
   * Si al sacar a alguien su letra queda sin nadie, la cabecera se va con él.
   * Una «W» sola sobre la nada se lee como una lista rota.
   */
  it('la letra que queda vacía desaparece', () => {
    const r = candidatosParaSumar({
      registrados: groupContactsByLetter([wilson, ana]),
      yaEstan: ['u1'],
    });

    expect(r.paraSumar.map((g) => g.letter)).toEqual(['A']);
  });

  it('sin nadie adentro devuelve la lista entera', () => {
    const r = candidatosParaSumar({
      registrados: groupContactsByLetter([wilson, ana]),
      yaEstan: [],
    });

    expect(r.paraSumar.flatMap((g) => g.contacts)).toHaveLength(2);
  });

  it('con todos adentro no queda ningún grupo', () => {
    const r = candidatosParaSumar({
      registrados: groupContactsByLetter([wilson, ana]),
      yaEstan: ['u1', 'u2'],
    });

    expect(r.paraSumar).toEqual([]);
  });

  /**
   * **El error que este módulo existe para no cometer.**
   *
   * «A quién falta invitar» se calcula cruzando la agenda del teléfono contra
   * los REGISTRADOS. Si ese cruce recibiera la lista ya recortada, Wilson —que
   * está en Lilachat y además ya está en el grupo— aparecería abajo en «Invitar
   * a Lilachat», ofreciéndole instalar una app que tiene.
   *
   * Por eso las dos listas salen de la misma función: separarlas invita a pasar
   * la recortada al lugar equivocado.
   */
  it('quien ya está en el grupo SIGUE contando como registrado', () => {
    const r = candidatosParaSumar({
      registrados: groupContactsByLetter([wilson, ana]),
      yaEstan: ['u1'],
    });

    expect(r.registrados.map((uno) => uno.id)).toEqual(['u2', 'u1']);
  });

  it('sin registrados todavía, las dos listas son vacías y no null', () => {
    const r = candidatosParaSumar({ registrados: [], yaEstan: ['u1'] });

    expect(r).toEqual({ paraSumar: [], registrados: [] });
  });
});

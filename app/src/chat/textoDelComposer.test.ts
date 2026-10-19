import { describe, expect, it } from 'vitest';
import { completarMencion, consultaDeMencion, insertarEnTexto, rangosDeMenciones, textoDeMencion } from './textoDelComposer';

const ANA = '665f1a2b3c4d5e6f70818294';
const BETO = '665f1a2b3c4d5e6f70818295';

/** El panel de emojis (José, 18/10): el emoji va donde está el cursor, no al final. */
describe('insertarEnTexto', () => {
  it('en el cursor, y el cursor queda después', () => {
    expect(insertarEnTexto('Hola mundo', { start: 4, end: 4 }, ' 😀')).toEqual({ texto: 'Hola 😀 mundo', cursor: 7 });
  });

  it('reemplaza lo seleccionado', () => {
    expect(insertarEnTexto('Hola mundo', { start: 5, end: 10 }, '🌎')).toEqual({ texto: 'Hola 🌎', cursor: 7 });
  });

  it('sin cursor conocido, al final', () => {
    expect(insertarEnTexto('Hola', null, '!')).toEqual({ texto: 'Hola!', cursor: 5 });
  });
});

describe('consultaDeMencion', () => {
  it('un «@» al principio o tras un espacio, hasta el cursor', () => {
    expect(consultaDeMencion('Hola @an', 8)).toEqual({ inicio: 5, consulta: 'an' });
    expect(consultaDeMencion('@', 1)).toEqual({ inicio: 0, consulta: '' });
  });

  it('un correo no es una mención', () => {
    expect(consultaDeMencion('jose@lila', 9)).toBeNull();
  });

  it('con un espacio después ya se terminó', () => {
    expect(consultaDeMencion('Hola @Ana ', 10)).toBeNull();
  });

  it('el cursor manda: más atrás no hay consulta', () => {
    expect(consultaDeMencion('Hola @an', 3)).toBeNull();
  });
});

describe('completarMencion', () => {
  it('cambia «@an» por «@Ana » y deja el cursor detrás', () => {
    expect(completarMencion('Hola @an qué tal', { inicio: 5, consulta: 'an' }, 'Ana')).toEqual({ texto: 'Hola @Ana  qué tal', cursor: 10 });
  });
});

describe('rangosDeMenciones', () => {
  it('encuentra cada «@Nombre» elegido en el texto final', () => {
    const elegidas = [
      { userId: ANA, nombre: 'Ana' },
      { userId: BETO, nombre: 'Beto Díaz' },
    ];
    expect(rangosDeMenciones('@Ana y @Beto Díaz, ¿vienen? @Ana', elegidas)).toEqual([
      { userId: ANA, desde: 0, largo: 4 },
      { userId: BETO, desde: 7, largo: 10 },
      { userId: ANA, desde: 28, largo: 4 },
    ]);
  });

  it('si la borró del texto, no va', () => {
    expect(rangosDeMenciones('Hola a todos', [{ userId: ANA, nombre: 'Ana' }])).toEqual([]);
  });

  it('«@Ana» no se confunde dentro de «@Anabel»', () => {
    expect(rangosDeMenciones('@Anabel', [{ userId: ANA, nombre: 'Ana' }])).toEqual([]);
  });
});

/** Cómo se lee una @mención en la burbuja (19/10: salía «@902049935» para mí). */
describe('textoDeMencion', () => {
  const nombres = new Map([
    [ANA, 'Ana'],
    [BETO, '960 397 018'],
    ['yo', '902049935'],
  ]);

  it('a mí, «@Tú»', () => {
    expect(textoDeMencion({ userId: 'yo', original: '@José', nombres, yo: 'yo' })).toBe('@Tú');
  });

  it('con el nombre que TÚ le tienes', () => {
    expect(textoDeMencion({ userId: ANA, original: '@Anita', nombres, yo: 'yo' })).toBe('@Ana');
  });

  it('si para ti es solo un número, queda el texto de quien escribió', () => {
    expect(textoDeMencion({ userId: BETO, original: '@Beto', nombres, yo: 'yo' })).toBe('@Beto');
  });

  it('sin nombres cargados, el texto original', () => {
    expect(textoDeMencion({ userId: ANA, original: '@Anita', nombres: undefined, yo: 'yo' })).toBe('@Anita');
  });
});

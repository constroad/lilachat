import { describe, expect, it } from 'vitest';
import { MAX_MENCIONES, partirEnMenciones, validarMenciones } from './menciones.js';

const ANA = '665f1a2b3c4d5e6f70818294';
const BETO = '665f1a2b3c4d5e6f70818295';

/**
 * José, 18/10: «en un grupo no puedo taggear un contacto colocando @». La
 * mención viaja como el texto que eligió quien escribe MÁS el rango y el id:
 * cada teléfono la dibuja con SU nombre para esa persona, y una app vieja
 * igual lee «@Ana».
 */
describe('validarMenciones', () => {
  const texto = 'Hola @Ana y @Beto, ¿vienen?';

  it('acepta rangos que caen sobre un «@» y son de miembros', () => {
    const menciones = [
      { userId: ANA, desde: 5, largo: 4 },
      { userId: BETO, desde: 12, largo: 5 },
    ];
    expect(validarMenciones(texto, menciones, [ANA, BETO])).toEqual(menciones);
  });

  it('descarta lo que no es de un miembro, sale del texto o no empieza con «@»', () => {
    const resultado = validarMenciones(
      texto,
      [
        { userId: '665f1a2b3c4d5e6f70818299', desde: 5, largo: 4 },
        { userId: ANA, desde: 40, largo: 4 },
        { userId: BETO, desde: 0, largo: 4 },
      ],
      [ANA, BETO]
    );
    expect(resultado).toEqual([]);
  });

  it('sin superposiciones, ordenadas y con tope', () => {
    const muchas = Array.from({ length: MAX_MENCIONES + 5 }, () => ({ userId: ANA, desde: 5, largo: 4 }));
    expect(validarMenciones(texto, muchas, [ANA])).toEqual([{ userId: ANA, desde: 5, largo: 4 }]);
    expect(
      validarMenciones(texto, [{ userId: BETO, desde: 12, largo: 5 }, { userId: ANA, desde: 5, largo: 4 }], [ANA, BETO]).map((m) => m.desde)
    ).toEqual([5, 12]);
  });

  it('basura en vez de un arreglo: ninguna', () => {
    expect(validarMenciones(texto, 'x' as never, [ANA])).toEqual([]);
    expect(validarMenciones(texto, [{ userId: ANA, desde: 'cinco', largo: 4 }] as never, [ANA])).toEqual([]);
  });
});

describe('partirEnMenciones', () => {
  it('parte el texto en tramos y menciones', () => {
    expect(partirEnMenciones('Hola @Ana!', [{ userId: ANA, desde: 5, largo: 4 }])).toEqual([
      { tipo: 'texto', texto: 'Hola ' },
      { tipo: 'mencion', userId: ANA, texto: '@Ana' },
      { tipo: 'texto', texto: '!' },
    ]);
  });

  it('sin menciones, un solo tramo', () => {
    expect(partirEnMenciones('hola', undefined)).toEqual([{ tipo: 'texto', texto: 'hola' }]);
  });

  it('un rango que ya no calza (mensaje editado) se ignora', () => {
    expect(partirEnMenciones('Hola Ana', [{ userId: ANA, desde: 5, largo: 4 }])).toEqual([{ tipo: 'texto', texto: 'Hola Ana' }]);
  });
});

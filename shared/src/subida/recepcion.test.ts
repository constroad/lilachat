import { describe, expect, it } from 'vitest';
import { decidirRecepcion, huellasQueFaltan } from './recepcion.js';

/**
 * El lado del server de la deduplicación (spec §6): el teléfono pregunta
 * antes de gastar datos, y cuando manda bytes el server los verifica antes de
 * confiar en la huella declarada.
 */
const HUELLA_A = 'a'.repeat(64);
const HUELLA_B = 'b'.repeat(64);
const HUELLA_C = 'c'.repeat(64);

describe('huellasQueFaltan', () => {
  it('devuelve solo las que el server no tiene', () => {
    const conocidas = new Set([HUELLA_A]);

    expect(huellasQueFaltan([HUELLA_A, HUELLA_B], conocidas)).toEqual({
      faltan: [HUELLA_B],
      invalidas: [],
    });
  });

  /** La misma huella dos veces en la consulta (dos copias en el teléfono) se pide UNA vez. */
  it('no repite una huella consultada dos veces', () => {
    expect(huellasQueFaltan([HUELLA_B, HUELLA_B], new Set())).toEqual({
      faltan: [HUELLA_B],
      invalidas: [],
    });
  });

  /** Lo malformado no se busca ni se sube: se devuelve para que el cliente lo vea. */
  it('separa lo que no es una huella', () => {
    expect(huellasQueFaltan(['ABC', HUELLA_C, ''], new Set())).toEqual({
      faltan: [HUELLA_C],
      invalidas: ['ABC', ''],
    });
  });

  it('conserva el orden de la consulta', () => {
    const resultado = huellasQueFaltan([HUELLA_C, HUELLA_A, HUELLA_B], new Set());

    expect(resultado.faltan).toEqual([HUELLA_C, HUELLA_A, HUELLA_B]);
  });
});

describe('decidirRecepcion', () => {
  it('si ya la tiene, no guarda: ya_existe', () => {
    expect(
      decidirRecepcion({ huellaDeclarada: HUELLA_A, huellaCalculada: HUELLA_A, yaExiste: true })
    ).toBe('ya_existe');
  });

  it('nueva y coincidente: guardar', () => {
    expect(
      decidirRecepcion({ huellaDeclarada: HUELLA_A, huellaCalculada: HUELLA_A, yaExiste: false })
    ).toBe('guardar');
  });

  /**
   * El archivo cambió entre que el teléfono lo hasheó y lo mandó (una edición
   * durante la subida), o llegó corrupto. Guardar con la huella declarada
   * marcaría como respaldado algo que no lo está.
   */
  it('si lo que llegó no es lo declarado, no se guarda', () => {
    expect(
      decidirRecepcion({ huellaDeclarada: HUELLA_A, huellaCalculada: HUELLA_B, yaExiste: false })
    ).toBe('huella_no_coincide');
  });

  /** La verificación va antes que la deduplicación: «ya existe» se decide sobre lo que LLEGÓ. */
  it('la discrepancia gana aunque la huella declarada exista', () => {
    expect(
      decidirRecepcion({ huellaDeclarada: HUELLA_A, huellaCalculada: HUELLA_B, yaExiste: true })
    ).toBe('huella_no_coincide');
  });
});

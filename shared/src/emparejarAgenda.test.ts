import { describe, expect, it } from 'vitest';
import { limpiarNumerosParaEmparejar, MAX_NUMEROS_POR_CONSULTA } from './emparejarAgenda.js';

/**
 * Emparejar MI agenda contra quién está registrado — como WhatsApp.
 *
 * El 26/08/2026 se abrió el registro y, para que quien entrara solo fuera
 * visible, la lista de contactos pasó a ser el padrón COMPLETO: cualquiera que
 * entrara veía el teléfono de toda la familia. José lo cortó en el acto: «cada
 * teléfono debería ver sus contactos guardados, como WhatsApp».
 *
 * El cambio es de dirección. Antes el server decía «acá están todos»; ahora el
 * teléfono pregunta «¿cuál de ESTOS que ya tengo está registrado?». Nadie puede
 * descubrir un número que no tuviera antes.
 */
describe('limpiarNumerosParaEmparejar', () => {
  it('normaliza lo que manda la agenda', () => {
    expect(limpiarNumerosParaEmparejar(['+51 999 111 222', '988-777-666'])).toEqual([
      '999111222',
      '988777666',
    ]);
  });

  it('descarta lo que no es un celular', () => {
    expect(limpiarNumerosParaEmparejar(['014567890', 'hola', '', '999111222'])).toEqual([
      '999111222',
    ]);
  });

  /** La agenda repite el mismo número como «casa» y «celular». */
  it('deduplica', () => {
    expect(limpiarNumerosParaEmparejar(['999111222', '+51999111222'])).toEqual(['999111222']);
  });

  /**
   * **El tope no es cosmético.** Sin él, una agenda de 5000 entradas arma una
   * consulta gigante contra Mongo, y alguien malintencionado puede mandar el
   * espacio entero de números para descubrir a todos los registrados — que es
   * justo lo que este diseño existe para impedir.
   */
  it('corta en el tope', () => {
    const muchos = Array.from({ length: MAX_NUMEROS_POR_CONSULTA + 500 }, (_, i) =>
      String(900000000 + i)
    );

    expect(limpiarNumerosParaEmparejar(muchos)).toHaveLength(MAX_NUMEROS_POR_CONSULTA);
  });

  it('lo que no es una lista da vacío', () => {
    expect(limpiarNumerosParaEmparejar(null)).toEqual([]);
    expect(limpiarNumerosParaEmparejar('999111222')).toEqual([]);
  });
});

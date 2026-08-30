import { describe, expect, it } from 'vitest';
import { conciliarPagina } from './conciliarMensajes.js';

const m = (seq: number, body = `m${seq}`) => ({ seq, body });

describe('conciliarPagina', () => {
  it('suma los que faltaban', () => {
    expect(conciliarPagina([m(1)], [m(1), m(2)]).map((uno) => uno.seq)).toEqual([1, 2]);
  });

  it('gana la versión del server sobre la guardada', () => {
    const r = conciliarPagina([m(1, 'viejo')], [m(1, 'editado')]);

    expect(r).toEqual([{ seq: 1, body: 'editado' }]);
  });

  /**
   * **El caso que este módulo existe para arreglar.** Un mensaje que ya no está
   * en el server se caía del chat en ningún lado: la caché del teléfono lo
   * conservaba para siempre. Pasó de verdad — quedaron líneas de una prueba mía
   * en el grupo de José después de borrarlas de la base (30/08/2026).
   */
  it('saca los que el server ya no tiene', () => {
    expect(conciliarPagina([m(1), m(2), m(3)], [m(1), m(3)]).map((uno) => uno.seq)).toEqual([1, 3]);
  });

  /**
   * **Solo DENTRO del rango que el server acaba de describir.** La página trae
   * los últimos N mensajes; lo de más atrás no lo mencionó, y borrar por
   * silencio vaciaría el historial viejo en cada apertura.
   */
  it('no toca lo que quedó fuera del rango', () => {
    const r = conciliarPagina([m(1), m(2), m(8), m(9)], [m(8), m(9)]);

    expect(r.map((uno) => uno.seq)).toEqual([1, 2, 8, 9]);
  });

  /**
   * Lo que llegó por socket DESPUÉS de pedir la página tampoco se toca: es más
   * nuevo que todo lo que el server contestó.
   */
  it('conserva lo que llegó después, más nuevo que la página', () => {
    const r = conciliarPagina([m(1), m(2), m(3)], [m(1), m(2)]);

    expect(r.map((uno) => uno.seq)).toEqual([1, 2, 3]);
  });

  /**
   * **Una página vacía no dice nada.** Puede ser el final del historial o una
   * respuesta rara; tomarla como «no hay nada» borraría el chat entero.
   */
  it('una página vacía deja todo como está', () => {
    const guardados = [m(1), m(2)];

    expect(conciliarPagina(guardados, [])).toBe(guardados);
  });

  it('sin nada guardado devuelve la página', () => {
    expect(conciliarPagina([], [m(4), m(5)]).map((uno) => uno.seq)).toEqual([4, 5]);
  });

  it('devuelve todo ordenado por seq', () => {
    expect(conciliarPagina([m(9), m(1)], [m(5)]).map((uno) => uno.seq)).toEqual([1, 5, 9]);
  });
});

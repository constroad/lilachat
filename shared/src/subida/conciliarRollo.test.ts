import { describe, expect, it } from 'vitest';
import { asientoTrasSubida, conciliarRollo } from './conciliarRollo.js';
import type { AsientoDelLibro, ElementoDelRollo } from './tipos.js';

/**
 * Conciliar es decidir, sin leer un solo byte, qué archivos del rollo hay que
 * mirar. Calcular la huella de 7 GB cuesta minutos y batería: solo se hace
 * sobre lo que el libro no conoce o conoce distinto.
 */
const HUELLA = 'a'.repeat(64);

const elemento = (extra: Partial<ElementoDelRollo> = {}): ElementoDelRollo => ({
  id: '1001',
  nombre: 'IMG_0001.jpg',
  bytes: 2_000_000,
  capturadoEn: Date.UTC(2026, 7, 31, 12, 0, 0),
  modificadoEn: Date.UTC(2026, 7, 31, 12, 0, 5),
  ...extra,
});

const asiento = (extra: Partial<AsientoDelLibro> = {}): AsientoDelLibro => ({
  id: '1001',
  huella: HUELLA,
  bytes: 2_000_000,
  modificadoEn: Date.UTC(2026, 7, 31, 12, 0, 5),
  subidoEn: Date.UTC(2026, 8, 1, 3, 0, 0),
  ...extra,
});

const libroCon = (...asientos: AsientoDelLibro[]) =>
  new Map(asientos.map((unAsiento) => [unAsiento.id, unAsiento]));

describe('conciliarRollo', () => {
  it('con rollo y libro vacíos no hay nada que hacer', () => {
    expect(conciliarRollo([], new Map())).toEqual({ pendientes: [], alDia: 0, desaparecidos: [] });
  });

  it('lo que el libro no conoce está pendiente', () => {
    const nuevo = elemento();

    const resultado = conciliarRollo([nuevo], new Map());

    expect(resultado.pendientes).toEqual([nuevo]);
    expect(resultado.alDia).toBe(0);
  });

  it('lo que el libro conoce igual está al día', () => {
    const resultado = conciliarRollo([elemento()], libroCon(asiento()));

    expect(resultado.pendientes).toEqual([]);
    expect(resultado.alDia).toBe(1);
  });

  /**
   * El id del MediaStore sobrevive a una edición: la foto recortada tiene el
   * mismo id y otro contenido. Si solo se mirara el id, la versión editada
   * jamás se respaldaría.
   */
  it('un archivo editado (otros bytes) vuelve a estar pendiente', () => {
    const editado = elemento({ bytes: 1_500_000 });

    const resultado = conciliarRollo([editado], libroCon(asiento()));

    expect(resultado.pendientes).toEqual([editado]);
  });

  /**
   * `getAssetsAsync` de Android no trae el tamaño: el rollo dice `0`. Eso es
   * «no sé», no «cero bytes»: el asiento guarda el tamaño real que se midió al
   * hashear y no puede quedar pendiente para siempre por esa diferencia.
   */
  it('un rollo sin tamaño (0) compara solo la modificación', () => {
    const sinTamano = elemento({ bytes: 0 });

    const resultado = conciliarRollo([sinTamano], libroCon(asiento({ bytes: 6_682 })));

    expect(resultado.pendientes).toEqual([]);
    expect(resultado.alDia).toBe(1);
  });

  it('un archivo con otra fecha de modificación vuelve a estar pendiente', () => {
    const tocado = elemento({ modificadoEn: Date.UTC(2026, 8, 2) });

    const resultado = conciliarRollo([tocado], libroCon(asiento()));

    expect(resultado.pendientes).toEqual([tocado]);
  });

  /**
   * Borrar en el teléfono NO borra en el server (spec §3.1). El libro sigue
   * sabiendo de esos archivos; se devuelven aparte para que la pantalla pueda
   * decir «12 borradas del teléfono siguen en el respaldo».
   */
  it('lo que el libro conoce y ya no está en el rollo es un desaparecido', () => {
    const borrado = asiento({ id: '9' });

    const resultado = conciliarRollo([elemento()], libroCon(asiento(), borrado));

    expect(resultado.desaparecidos).toEqual([borrado]);
    expect(resultado.alDia).toBe(1);
  });

  it('conserva el orden del rollo: el orden de subida lo decide otro', () => {
    const a = elemento({ id: 'a' });
    const b = elemento({ id: 'b' });
    const c = elemento({ id: 'c' });

    const resultado = conciliarRollo([c, a, b], new Map());

    expect(resultado.pendientes.map((unElemento) => unElemento.id)).toEqual(['c', 'a', 'b']);
  });

  it('no muta ni el rollo ni el libro', () => {
    const rollo = [elemento()];
    const libro = libroCon(asiento({ id: 'otro' }));

    conciliarRollo(rollo, libro);

    expect(rollo).toHaveLength(1);
    expect(libro.size).toBe(1);
  });
});

describe('asientoTrasSubida', () => {
  /**
   * El asiento congela bytes y modificación DEL MOMENTO en que se calculó la
   * huella. Si se tomaran del rollo al anotar, una edición hecha durante la
   * subida quedaría marcada como respaldada sin estarlo.
   */
  it('congela lo que se subió, con la hora de la subida', () => {
    const ahora = Date.UTC(2026, 8, 1, 3, 0, 0);

    expect(asientoTrasSubida(elemento(), HUELLA, ahora)).toEqual({
      id: '1001',
      huella: HUELLA,
      bytes: 2_000_000,
      modificadoEn: Date.UTC(2026, 7, 31, 12, 0, 5),
      subidoEn: ahora,
    });
  });

  it('el asiento deja al elemento al día en la siguiente conciliación', () => {
    const unElemento = elemento();
    const nuevoAsiento = asientoTrasSubida(unElemento, HUELLA, Date.now());

    const resultado = conciliarRollo([unElemento], libroCon(nuevoAsiento));

    expect(resultado.pendientes).toEqual([]);
    expect(resultado.alDia).toBe(1);
  });
});

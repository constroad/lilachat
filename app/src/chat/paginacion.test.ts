import { describe, expect, it } from 'vitest';
import { decidirCargaAnterior, TAMANO_PAGINA } from './paginacion';

/**
 * Cargar los mensajes viejos al llegar arriba, como WhatsApp.
 *
 * Hasta el 26/08/2026 el chat pedía UNA página —los últimos 50— y nunca más:
 * scrolleando hacia arriba la conversación simplemente se terminaba. El server
 * ya sabía paginar (`beforeSeq`), el cliente nunca se lo pidió.
 *
 * Lo que este motor evita es el defecto clásico de la carga por scroll: pedir
 * la misma página tres veces porque el evento se dispara en cada cuadro.
 */
describe('decidirCargaAnterior', () => {
  const mensajes = [{ seq: 10 }, { seq: 11 }, { seq: 12 }];

  it('pide desde el mensaje MÁS VIEJO que tengo', () => {
    const salida = decidirCargaAnterior({ mensajes, cargando: false, hayMas: true });

    expect(salida).toEqual({ cargar: true, beforeSeq: 10, limit: TAMANO_PAGINA });
  });

  /**
   * El evento de «llegué arriba» se dispara muchas veces mientras el dedo
   * sigue moviéndose. Sin este freno se piden tres páginas iguales y la lista
   * salta.
   */
  it('no pide otra si ya hay una en vuelo', () => {
    expect(decidirCargaAnterior({ mensajes, cargando: true, hayMas: true }).cargar).toBe(false);
  });

  /** Ya se llegó al principio de la conversación: no hay nada más que pedir. */
  it('no pide cuando ya no hay más', () => {
    expect(decidirCargaAnterior({ mensajes, cargando: false, hayMas: false }).cargar).toBe(false);
  });

  /**
   * Sin mensajes todavía no se sabe desde dónde pedir. La primera página la
   * trae la carga inicial, no el scroll.
   */
  it('con la lista vacía no hace nada', () => {
    expect(decidirCargaAnterior({ mensajes: [], cargando: false, hayMas: true }).cargar).toBe(false);
  });

  /**
   * Los optimistas todavía no tienen `seq` del server —van con
   * `Number.MAX_SAFE_INTEGER`— y no pueden decidir desde dónde pedir: si se
   * tomaran, `beforeSeq` sería absurdo y el server devolvería todo otra vez.
   */
  it('ignora los mensajes sin seq real', () => {
    const salida = decidirCargaAnterior({
      mensajes: [{ seq: Number.MAX_SAFE_INTEGER }, { seq: 7 }],
      cargando: false,
      hayMas: true,
    });

    expect(salida).toEqual({ cargar: true, beforeSeq: 7, limit: TAMANO_PAGINA });
  });

  it('si TODOS son optimistas, no pide', () => {
    expect(
      decidirCargaAnterior({
        mensajes: [{ seq: Number.MAX_SAFE_INTEGER }],
        cargando: false,
        hayMas: true,
      }).cargar
    ).toBe(false);
  });
});

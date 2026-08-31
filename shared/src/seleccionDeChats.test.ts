import { describe, expect, it } from 'vitest';
import { accionesDeSeleccion, ordenarChats, type ChatSeleccionable } from './seleccionDeChats.js';

const chat = (p: Partial<ChatSeleccionable> & { id: string }): ChatSeleccionable => ({
  esGrupo: false,
  muted: false,
  pinned: false,
  unread: 0,
  fechaOrden: 0,
  ...p,
});

describe('accionesDeSeleccion', () => {
  it('sin selección, ninguna acción', () => {
    expect(accionesDeSeleccion([])).toEqual({
      silenciar: null,
      fijar: null,
      puedeMarcarLeido: false,
      salir: false,
    });
  });

  /**
   * **El texto de silenciar depende del conjunto.** Si TODOS están
   * silenciados, la acción es reactivar; si alguno no lo está, silenciar. Es lo
   * que hace WhatsApp: una sola acción para el lote.
   */
  it('todos silenciados → reactivar; alguno no → silenciar', () => {
    expect(accionesDeSeleccion([chat({ id: 'a', muted: true })]).silenciar).toBe('reactivar');
    expect(
      accionesDeSeleccion([chat({ id: 'a', muted: true }), chat({ id: 'b', muted: false })]).silenciar
    ).toBe('silenciar');
  });

  it('todos fijados → desfijar; alguno no → fijar', () => {
    expect(accionesDeSeleccion([chat({ id: 'a', pinned: true })]).fijar).toBe('desfijar');
    expect(
      accionesDeSeleccion([chat({ id: 'a', pinned: true }), chat({ id: 'b' })]).fijar
    ).toBe('fijar');
  });

  /** Marcar leído solo tiene sentido si HAY algo sin leer en la selección. */
  it('marcar leído solo si hay no leídos', () => {
    expect(accionesDeSeleccion([chat({ id: 'a', unread: 0 })]).puedeMarcarLeido).toBe(false);
    expect(accionesDeSeleccion([chat({ id: 'a', unread: 3 })]).puedeMarcarLeido).toBe(true);
  });

  /**
   * «Salir» es de grupos. Solo se ofrece si TODA la selección son grupos:
   * mezclado con un 1:1 la acción no aplica a todos y confunde.
   */
  it('salir solo si toda la selección son grupos', () => {
    expect(accionesDeSeleccion([chat({ id: 'a', esGrupo: true })]).salir).toBe(true);
    expect(
      accionesDeSeleccion([chat({ id: 'a', esGrupo: true }), chat({ id: 'b', esGrupo: false })]).salir
    ).toBe(false);
  });
});

describe('ordenarChats', () => {
  /**
   * **Los fijados arriba, y entre ellos por recencia; después el resto por
   * recencia.** Es el orden de WhatsApp: fijar saca el chat del flujo del
   * tiempo y lo clava arriba.
   */
  it('fijados primero, cada grupo por fecha desc', () => {
    const chats = [
      chat({ id: 'viejo', fechaOrden: 1 }),
      chat({ id: 'fijado-viejo', pinned: true, fechaOrden: 2 }),
      chat({ id: 'nuevo', fechaOrden: 5 }),
      chat({ id: 'fijado-nuevo', pinned: true, fechaOrden: 4 }),
    ];

    expect(ordenarChats(chats).map((c) => c.id)).toEqual([
      'fijado-nuevo',
      'fijado-viejo',
      'nuevo',
      'viejo',
    ]);
  });

  it('sin fijados, es solo por fecha desc', () => {
    const chats = [chat({ id: 'a', fechaOrden: 1 }), chat({ id: 'b', fechaOrden: 3 })];
    expect(ordenarChats(chats).map((c) => c.id)).toEqual(['b', 'a']);
  });

  /** No muta el arreglo original. */
  it('devuelve una copia', () => {
    const chats = [chat({ id: 'a', fechaOrden: 1 })];
    expect(ordenarChats(chats)).not.toBe(chats);
  });
});

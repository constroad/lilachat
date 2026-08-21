import { describe, expect, it } from 'vitest';
import { advanceCursors, mergeBySeq, unreadCount } from './sync.js';

describe('advanceCursors', () => {
  it('avanza al seq más alto recibido por chat', () => {
    const next = advanceCursors(
      { a: 3 },
      [{ chatId: 'a', messages: [{ seq: 4 }, { seq: 5 }] }, { chatId: 'b', messages: [{ seq: 1 }] }]
    );

    expect(next).toEqual({ a: 5, b: 1 });
  });

  /**
   * Un lote viejo que llega tarde —reintento, dos sockets abiertos— no puede
   * hacer retroceder el cursor: si retrocediera, se volverían a pedir mensajes
   * ya recibidos y el barrido no terminaría nunca.
   */
  it('NUNCA retrocede', () => {
    expect(advanceCursors({ a: 10 }, [{ chatId: 'a', messages: [{ seq: 4 }] }])).toEqual({ a: 10 });
  });

  it('un lote vacío no toca nada', () => {
    expect(advanceCursors({ a: 2 }, [{ chatId: 'a', messages: [] }])).toEqual({ a: 2 });
  });
});

describe('mergeBySeq', () => {
  /** El mismo mensaje llega por el socket Y por el lote de sync. */
  it('deduplica por seq: reconectar no duplica lo último', () => {
    const merged = mergeBySeq([{ seq: 1 }, { seq: 2 }], [{ seq: 2 }, { seq: 3 }]);

    expect(merged.map((message) => message.seq)).toEqual([1, 2, 3]);
  });

  it('ordena por seq aunque lleguen desordenados', () => {
    const merged = mergeBySeq([{ seq: 5 }], [{ seq: 2 }, { seq: 9 }]);

    expect(merged.map((message) => message.seq)).toEqual([2, 5, 9]);
  });

  it('el entrante gana: trae ediciones y borrados', () => {
    const merged = mergeBySeq([{ seq: 1, body: 'viejo' }], [{ seq: 1, body: 'editado' }]);

    expect(merged[0]?.body).toBe('editado');
  });
});

describe('unreadCount', () => {
  it('es una resta, no un conteo de documentos', () => {
    expect(unreadCount({ lastSeq: 10, readSeq: 7 })).toBe(3);
    expect(unreadCount({ lastSeq: 10, readSeq: 10 })).toBe(0);
  });

  it('un cursor por delante del último no da negativo', () => {
    expect(unreadCount({ lastSeq: 4, readSeq: 9 })).toBe(0);
  });
});

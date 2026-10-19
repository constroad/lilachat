import { describe, expect, it } from 'vitest';
import {
  applyEffect,
  buildOutboxItem,
  descartarDeLaCola,
  enqueue,
  nextPending,
  reintentarEnLaCola,
  resolveOutcome,
  retryDelayMs,
  type OutboxItem,
} from './outbox.js';

const item = (overrides: Partial<OutboxItem> = {}): OutboxItem => ({
  clientKey: 'ck-1',
  chatId: '6a7e17a94f3b25138a1f5a0f',
  kind: 'text',
  body: 'hola',
  queuedAt: '2026-08-20T12:00:00.000Z',
  attempts: 0,
  ...overrides,
});

describe('enqueue', () => {
  it('el mismo clientKey no entra dos veces (doble tap del usuario)', () => {
    const queue = enqueue(enqueue([], item()), item({ body: 'hola de nuevo' }));

    expect(queue).toHaveLength(1);
    expect(queue[0]?.body).toBe('hola');
  });

  it('mensajes distintos conservan el orden en que se escribieron', () => {
    const queue = enqueue(enqueue([], item({ clientKey: 'a' })), item({ clientKey: 'b' }));

    expect(queue.map((entry) => entry.clientKey)).toEqual(['a', 'b']);
    expect(nextPending(queue)?.clientKey).toBe('a');
  });
});

describe('resolveOutcome', () => {
  it('enviado: se confirma con su seq', () => {
    expect(resolveOutcome(item(), { status: 'sent', seq: 7 })).toEqual({
      action: 'confirm',
      clientKey: 'ck-1',
      seq: 7,
    });
  });

  /**
   * La regla que más se lee mal: el server diciendo «ya lo tenía» significa que
   * el hecho ESTÁ guardado. Tratarlo como error deja el mensaje reintentando
   * para siempre y en pantalla como «no enviado» aunque llegó.
   */
  it('duplicado del server: es ÉXITO, no error', () => {
    expect(resolveOutcome(item(), { status: 'duplicate', seq: 7 })).toEqual({
      action: 'confirm',
      clientKey: 'ck-1',
      seq: 7,
    });
  });

  it('sin red: se reintenta, nunca se descarta', () => {
    const effect = resolveOutcome(item({ attempts: 2 }), { status: 'unreachable' });

    expect(effect.action).toBe('retry');
    expect(effect).toMatchObject({ delayMs: 2_000 });
  });

  it('5xx: el server está mal, no el mensaje → reintento', () => {
    expect(resolveOutcome(item(), { status: 'rejected', httpStatus: 500 }).action).toBe('retry');
  });

  /**
   * FL8 (auditoría 17/10/2026): un rechazo permanente ya NO borra el mensaje.
   * Antes se descartaba y la burbuja desaparecía sin aviso. Ahora queda
   * marcado como fallido —con el motivo— y la persona decide.
   */
  it.each([400, 403, 404, 410, 413, 422])('rechazo permanente %i: queda FALLIDO con su motivo', (httpStatus) => {
    const effect = resolveOutcome(item(), {
      status: 'rejected',
      httpStatus,
      message: 'Ese chat ya no existe.',
    });

    expect(effect).toEqual({ action: 'fail', clientKey: 'ck-1', reason: 'Ese chat ya no existe.' });
  });

  it('rechazo sin mensaje: un motivo genérico, nunca vacío', () => {
    expect(resolveOutcome(item(), { status: 'rejected', httpStatus: 400 })).toMatchObject({
      reason: 'El servidor rechazó este mensaje.',
    });
  });

  it('401: la sesión no vale — todo queda fallido (no se borra lo escrito)', () => {
    expect(resolveOutcome(item(), { status: 'unauthorized' })).toEqual({
      action: 'fail-all',
      reason: 'Tu sesión venció. Vuelve a entrar para mandarlo.',
    });
  });
});

describe('applyEffect', () => {
  const queue = [item({ clientKey: 'a' }), item({ clientKey: 'b' })];

  it('confirmar saca ese ítem y respeta el resto', () => {
    const result = applyEffect(queue, { action: 'confirm', clientKey: 'a', seq: 1 });

    expect(result.map((entry) => entry.clientKey)).toEqual(['b']);
  });

  it('fallar marca ESE ítem con el motivo y no lo saca', () => {
    const result = applyEffect(queue, { action: 'fail', clientKey: 'a', reason: 'Ese chat ya no existe.' });

    expect(result.map((entry) => [entry.clientKey, entry.fallo ?? null])).toEqual([
      ['a', 'Ese chat ya no existe.'],
      ['b', null],
    ]);
  });

  it('fail-all marca todos los que no estaban fallidos', () => {
    const conUno = [item({ clientKey: 'a', fallo: 'otro motivo' }), item({ clientKey: 'b' })];
    const result = applyEffect(conUno, { action: 'fail-all', reason: 'sesión' });

    expect(result.map((entry) => entry.fallo)).toEqual(['otro motivo', 'sesión']);
  });

  it('reintentar cuenta el intento sin perder el mensaje', () => {
    const result = applyEffect(queue, { action: 'retry', clientKey: 'a', delayMs: 1000 });

    expect(result[0]).toMatchObject({ clientKey: 'a', attempts: 1 });
    expect(result).toHaveLength(2);
  });

});

describe('fallidos en la cola', () => {
  /** Anti-wedge: el fallido no bloquea a los de atrás. */
  it('nextPending saltea los fallidos', () => {
    const cola = [item({ clientKey: 'a', fallo: 'x' }), item({ clientKey: 'b' })];

    expect(nextPending(cola)?.clientKey).toBe('b');
  });

  it('con todos fallidos no hay nada que mandar', () => {
    expect(nextPending([item({ fallo: 'x' })])).toBeNull();
  });

  it('reintentar le saca la marca y empieza de cero, en su mismo lugar', () => {
    const cola = [item({ clientKey: 'a', fallo: 'x', attempts: 3 }), item({ clientKey: 'b' })];
    const result = reintentarEnLaCola(cola, 'a');

    expect(result[0]).toMatchObject({ clientKey: 'a', attempts: 0 });
    expect(result[0]?.fallo).toBeUndefined();
    expect(result[1]?.clientKey).toBe('b');
  });

  it('descartar lo saca para siempre', () => {
    const cola = [item({ clientKey: 'a', fallo: 'x' }), item({ clientKey: 'b' })];

    expect(descartarDeLaCola(cola, 'a').map((entry) => entry.clientKey)).toEqual(['b']);
  });
});

describe('retryDelayMs', () => {
  it('crece exponencialmente y tiene techo', () => {
    expect(retryDelayMs(1)).toBe(1_000);
    expect(retryDelayMs(3)).toBe(4_000);
    expect(retryDelayMs(50)).toBe(60_000);
  });
});

describe('buildOutboxItem', () => {
  const sobre = { v: 1 as const, nonce: 'bm9uY2U=', ciphertext: 'c2VjcmV0bw==' };

  it('en un chat normal encola el texto', () => {
    const item = buildOutboxItem({
      chatId: 'c1',
      clientKey: 'k1',
      text: 'hola',
      queuedAt: '2026-08-24T12:00:00Z',
    });

    expect(item.body).toBe('hola');
    expect(item.envelope).toBeUndefined();
  });

  /**
   * LA regla del chat secreto: la cola vive en AsyncStorage, o sea en DISCO.
   * Encolar el texto plano dejaría el mensaje legible en el teléfono aunque el
   * server nunca lo vea — el candado no serviría de nada contra quien tenga el
   * aparato. Se cifra ANTES de encolar.
   */
  /** Las @menciones (18/10) viajan con el texto, sobre el texto YA recortado. */
  it('lleva las menciones en un chat normal, recalculadas sobre el texto recortado', () => {
    const item = buildOutboxItem({
      chatId: 'c1',
      clientKey: 'k1',
      text: '  Hola @Ana',
      queuedAt: '2026-08-24T12:00:00Z',
      menciones: (texto) => (texto === 'Hola @Ana' ? [{ userId: 'u-ana', desde: 5, largo: 4 }] : []),
    });

    expect(item?.menciones).toEqual([{ userId: 'u-ana', desde: 5, largo: 4 }]);
  });

  it('sin menciones no agrega el campo; en un chat cifrado nunca', () => {
    const sinMenciones = buildOutboxItem({ chatId: 'c1', clientKey: 'k1', text: 'hola', queuedAt: '2026-08-24T12:00:00Z', menciones: () => [] });
    const cifrado = buildOutboxItem({
      chatId: 'c1',
      clientKey: 'k1',
      text: 'hola @Ana',
      queuedAt: '2026-08-24T12:00:00Z',
      seal: () => sobre,
      menciones: () => [{ userId: 'u-ana', desde: 5, largo: 4 }],
    });

    expect(sinMenciones && 'menciones' in sinMenciones).toBe(false);
    expect(cifrado && 'menciones' in cifrado).toBe(false);
  });

  it('en un chat cifrado encola el SOBRE y nunca el texto', () => {
    const item = buildOutboxItem({
      chatId: 'c1',
      clientKey: 'k1',
      text: 'la clave es 4821',
      queuedAt: '2026-08-24T12:00:00Z',
      seal: () => sobre,
    });

    expect(item.body).toBeUndefined();
    expect(item.envelope).toEqual(sobre);
    expect(JSON.stringify(item)).not.toContain('4821');
  });

  /**
   * Si el cifrado falla —falta la clave del otro— NO se encola en claro. Un
   * fallback a texto plano sería el peor error posible: el usuario ve el
   * candado y el mensaje sale desnudo.
   */
  it('si no se puede cifrar, no encola nada', () => {
    expect(
      buildOutboxItem({
        chatId: 'c1',
        clientKey: 'k1',
        text: 'secreto',
        queuedAt: '2026-08-24T12:00:00Z',
        seal: () => null,
      })
    ).toBeNull();
  });

  it('un texto vacío no se encola', () => {
    expect(
      buildOutboxItem({ chatId: 'c1', clientKey: 'k1', text: '   ', queuedAt: 'x' })
    ).toBeNull();
  });
});

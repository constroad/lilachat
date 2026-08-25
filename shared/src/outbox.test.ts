import { describe, expect, it } from 'vitest';
import {
  applyEffect,
  buildOutboxItem,
  enqueue,
  nextPending,
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

  /** Anti-wedge: si se quedara al frente, mataría toda la cola detrás. */
  it.each([400, 403, 404, 410, 413, 422])('rechazo permanente %i: se descarta con motivo', (httpStatus) => {
    const effect = resolveOutcome(item(), {
      status: 'rejected',
      httpStatus,
      message: 'Ese chat ya no existe.',
    });

    expect(effect).toEqual({
      action: 'discard',
      clientKey: 'ck-1',
      reason: 'Ese chat ya no existe.',
    });
  });

  it('401: la credencial no vale — se vacía la cola entera', () => {
    expect(resolveOutcome(item(), { status: 'unauthorized' })).toMatchObject({
      action: 'clear-all',
    });
  });
});

describe('applyEffect', () => {
  const queue = [item({ clientKey: 'a' }), item({ clientKey: 'b' })];

  it('confirmar saca ese ítem y respeta el resto', () => {
    const result = applyEffect(queue, { action: 'confirm', clientKey: 'a', seq: 1 });

    expect(result.map((entry) => entry.clientKey)).toEqual(['b']);
  });

  it('descartar saca ese ítem — la cola sigue avanzando', () => {
    const result = applyEffect(queue, { action: 'discard', clientKey: 'a', reason: 'x' });

    expect(result.map((entry) => entry.clientKey)).toEqual(['b']);
  });

  it('reintentar cuenta el intento sin perder el mensaje', () => {
    const result = applyEffect(queue, { action: 'retry', clientKey: 'a', delayMs: 1000 });

    expect(result[0]).toMatchObject({ clientKey: 'a', attempts: 1 });
    expect(result).toHaveLength(2);
  });

  it('clear-all deja la cola vacía', () => {
    expect(applyEffect(queue, { action: 'clear-all', reason: 'x' })).toEqual([]);
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

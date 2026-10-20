import { describe, expect, it } from 'vitest';
import { enviarPorSocket, resultadoDeAccion, resultadoDelAck } from './envioPorSocket';

/** El acuse de `msg.send` (server/src/socket.ts) traducido al motor de la cola. */
describe('resultadoDelAck', () => {
  it('ok con seq es enviado', () => {
    expect(resultadoDelAck({ ok: true, seq: 12 })).toEqual({ status: 'sent', seq: 12 });
  });

  it('ok con duplicate es duplicado: el server ya lo tenía', () => {
    expect(resultadoDelAck({ ok: true, seq: 12, duplicate: true })).toEqual({ status: 'duplicate', seq: 12 });
  });

  it('403 es un rechazo con el motivo del server', () => {
    expect(resultadoDelAck({ ok: false, status: 403, message: 'Ya no eres miembro' })).toEqual({
      status: 'rejected',
      httpStatus: 403,
      message: 'Ya no eres miembro',
    });
  });

  it('401 es sesión vencida', () => {
    expect(resultadoDelAck({ ok: false, status: 401 })).toEqual({ status: 'unauthorized' });
  });

  it('un fallo sin código cuenta como 500: se reintenta, no se descarta', () => {
    expect(resultadoDelAck({ ok: false })).toEqual({ status: 'rejected', httpStatus: 500, message: undefined });
  });

  it('un acuse raro o vacío es «sin respuesta», nunca un éxito', () => {
    expect(resultadoDelAck(undefined)).toEqual({ status: 'unreachable' });
    expect(resultadoDelAck({ ok: true })).toEqual({ status: 'unreachable' });
  });
});

/** El acuse de `msg.edit` y `msg.delete`: `{ok}` o `{ok:false, motivo}` (server/src/socket.ts). */
describe('resultadoDeAccion', () => {
  it('ok, con la hora de edición si viene', () => {
    expect(resultadoDeAccion({ ok: true, editedAt: '2026-10-19T18:00:00.000Z' })).toEqual({ ok: true, editedAt: '2026-10-19T18:00:00.000Z' });
    expect(resultadoDeAccion({ ok: true })).toEqual({ ok: true });
  });

  it('rechazo con el motivo del server', () => {
    expect(resultadoDeAccion({ ok: false, motivo: 'Pasaron más de 15 minutos' })).toEqual({ ok: false, motivo: 'Pasaron más de 15 minutos' });
  });

  it('sin acuse o raro: falla con un motivo que se entiende', () => {
    expect(resultadoDeAccion(undefined)).toEqual({ ok: false, motivo: 'No se pudo. Revisa tu conexión.' });
  });
});

/** E3 (20/10): la respuesta de un hilo viaja con su raíz. */
describe('enviarPorSocket con hilo', () => {
  it('manda hiloDe y enElChat en el frame', async () => {
    let frame: Record<string, unknown> = {};
    const socket = { connected: true, timeout: () => ({ emitWithAck: async (_evento: string, datos: Record<string, unknown>) => ((frame = datos), { ok: true, seq: 9 }) }) };
    const r = await enviarPorSocket(socket as never, { clientKey: 'k', chatId: 'c', kind: 'text', body: 'yo', hiloDe: 3, enElChat: true, queuedAt: 'x', attempts: 0 });
    expect(r).toEqual({ status: 'sent', seq: 9 });
    expect(frame).toMatchObject({ hiloDe: 3, enElChat: true });
  });
});

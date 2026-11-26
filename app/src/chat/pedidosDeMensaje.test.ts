import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSocket } from './socketClient';
import { pedirEditar, pedirEliminar, OFFLINE_REQUEST_REASON, NO_SERVER_ANSWER_REASON } from './pedidosDeMensaje';

vi.mock('./socketClient', () => ({ getSocket: vi.fn() }));

type Ack = (error: unknown, reply?: unknown) => void;
function socketThat(connected: boolean, answer: (ack: Ack) => void) {
  const emit = vi.fn((_event: string, _frame: object, ack: Ack) => answer(ack));
  const timeout = vi.fn(() => ({ emit }));
  vi.mocked(getSocket).mockReturnValue({ connected, timeout } as never);
  return { emit, timeout };
}

beforeEach(() => vi.clearAllMocks());

describe('editing or deleting a sent message (26/11, offline)', () => {
  it('without a connection says so at once and sends nothing', async () => {
    const socket = socketThat(false, () => undefined);
    await expect(pedirEliminar('6650f1a2b3c4d5e6f7a8b9c0', 12)).resolves.toEqual({ ok: false, motivo: OFFLINE_REQUEST_REASON });
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('with a connection asks the server and reads its answer', async () => {
    const socket = socketThat(true, (ack) => ack(null, { ok: true }));
    await expect(pedirEditar('6650f1a2b3c4d5e6f7a8b9c0', 12, 'hola')).resolves.toEqual({ ok: true, motivo: undefined });
    expect(socket.emit).toHaveBeenCalledWith('msg.edit', { chatId: '6650f1a2b3c4d5e6f7a8b9c0', seq: 12, body: 'hola' }, expect.any(Function));
  });

  it('a refusal comes back with its reason', async () => {
    socketThat(true, (ack) => ack(null, { ok: false, motivo: 'Ya pasaron 15 minutos.' }));
    await expect(pedirEditar('6650f1a2b3c4d5e6f7a8b9c0', 12, 'hola')).resolves.toEqual({ ok: false, motivo: 'Ya pasaron 15 minutos.' });
  });

  it('an answer that never comes does not hang the screen', async () => {
    socketThat(true, (ack) => ack(new Error('operation has timed out')));
    await expect(pedirEliminar('6650f1a2b3c4d5e6f7a8b9c0', 12)).resolves.toEqual({ ok: false, motivo: NO_SERVER_ANSWER_REASON });
  });
});

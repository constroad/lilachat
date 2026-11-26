import { getSocket } from './socketClient';

/**
 * Lo que se le PIDE al server sobre un mensaje ya enviado: borrarlo para todos
 * o editarlo. El server decide y avisa a todos (`msg.deleted` / `msg.edited`),
 * así que acá NO se toca la lista: se espera el eco. Adelantarse haría que un
 * rechazo dejara la pantalla mintiendo. El motivo del «no» vuelve para decirlo.
 */
export type RespuestaDePedido = { ok: boolean; motivo?: string };

/** Without signal nothing is sent (26/11): the person reads it at once instead of a screen that waits forever. */
export const OFFLINE_REQUEST_REASON = 'Sin señal. Edita o borra el mensaje cuando vuelva la red.';
export const NO_SERVER_ANSWER_REASON = 'El servidor no respondió. Inténtalo de nuevo.';
/** The same wait as a reaction (`useCambiosDeMensajes`). */
const ANSWER_WAIT_MS = 8000;

function pedir(evento: string, frame: object): Promise<RespuestaDePedido> {
  return new Promise((resolve) => {
    const socket = getSocket();
    if (!socket?.connected) return resolve({ ok: false, motivo: OFFLINE_REQUEST_REASON });
    socket.timeout(ANSWER_WAIT_MS).emit(evento, frame, (error: unknown, r: unknown) => {
      if (error) return resolve({ ok: false, motivo: NO_SERVER_ANSWER_REASON });
      const respuesta = (r ?? {}) as { ok?: boolean; motivo?: string };
      resolve({ ok: Boolean(respuesta.ok), motivo: respuesta.motivo });
    });
  });
}

export const pedirEliminar = (chatId: string, seq: number) => pedir('msg.delete', { chatId, seq });

export const pedirEditar = (chatId: string, seq: number, body: string) => pedir('msg.edit', { chatId, seq, body });

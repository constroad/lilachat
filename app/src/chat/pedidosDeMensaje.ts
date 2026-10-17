import { getSocket } from './socketClient';

/**
 * Lo que se le PIDE al server sobre un mensaje ya enviado: borrarlo para todos
 * o editarlo. El server decide y avisa a todos (`msg.deleted` / `msg.edited`),
 * así que acá NO se toca la lista: se espera el eco. Adelantarse haría que un
 * rechazo dejara la pantalla mintiendo. El motivo del «no» vuelve para decirlo.
 */
export type RespuestaDePedido = { ok: boolean; motivo?: string };

function pedir(evento: string, frame: object): Promise<RespuestaDePedido> {
  return new Promise((resolve) => {
    const socket = getSocket();
    if (!socket) return resolve({ ok: false, motivo: 'Sin conexión.' });
    socket.emit(evento, frame, (r: unknown) => {
      const respuesta = (r ?? {}) as { ok?: boolean; motivo?: string };
      resolve({ ok: Boolean(respuesta.ok), motivo: respuesta.motivo });
    });
  });
}

export const pedirEliminar = (chatId: string, seq: number) => pedir('msg.delete', { chatId, seq });

export const pedirEditar = (chatId: string, seq: number, body: string) => pedir('msg.edit', { chatId, seq, body });

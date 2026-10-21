import type { Socket } from 'socket.io-client';
import type { OutboxItem, SendOutcome, WinkId } from '@lilachat/shared';
import type { LoteDeSincronizacion } from './sincronizar';

/** Más que esto sin acuse es «sin respuesta»: se reintenta con la misma clave. */
const ESPERA_DEL_ACUSE_MS = 12_000;

type Acuse = { ok?: boolean; seq?: unknown; duplicate?: boolean; status?: number; message?: string };

/**
 * El acuse de `msg.send` traducido al motor de la cola. Es la misma regla que
 * `app/src/chat/socketClient.ts`: un acuse sin `seq` no es éxito.
 */
export function resultadoDelAck(acuse: unknown): SendOutcome {
  const respuesta = (acuse ?? {}) as Acuse;
  if (respuesta.ok === true) {
    if (typeof respuesta.seq !== 'number') return { status: 'unreachable' };
    return respuesta.duplicate ? { status: 'duplicate', seq: respuesta.seq } : { status: 'sent', seq: respuesta.seq };
  }
  if (respuesta.ok !== false) return { status: 'unreachable' };
  if (respuesta.status === 401) return { status: 'unauthorized' };
  return { status: 'rejected', httpStatus: respuesta.status ?? 500, message: respuesta.message };
}

/** Manda un ítem de la cola por el socket. Sin socket o sin acuse: «sin respuesta». */
export async function enviarPorSocket(socket: Socket | null, item: OutboxItem): Promise<SendOutcome> {
  if (!socket?.connected) return { status: 'unreachable' };
  const { clientKey, chatId, kind, body, menciones, replyToSeq, hiloDe, enElChat } = item;
  try {
    const acuse = await socket
      .timeout(ESPERA_DEL_ACUSE_MS)
      .emitWithAck('msg.send', { clientKey, chatId, kind, body, menciones, replyToSeq, hiloDe, enElChat });
    return resultadoDelAck(acuse);
  } catch {
    // Timeout: el mensaje pudo haber llegado. La clave evita el duplicado.
    return { status: 'unreachable' };
  }
}

/** `sync.pull`: lo que falta desde mis cursores. `null` = sin respuesta. */
export async function pedirSincronizacion(
  socket: Socket | null,
  cursores: Record<string, number>
): Promise<LoteDeSincronizacion[] | null> {
  if (!socket?.connected) return null;
  try {
    const acuse = (await socket.timeout(ESPERA_DEL_ACUSE_MS).emitWithAck('sync.pull', { cursors: cursores })) as {
      ok?: boolean;
      batches?: LoteDeSincronizacion[];
    };
    return acuse?.ok && Array.isArray(acuse.batches) ? acuse.batches : null;
  } catch {
    return null;
  }
}

export type ResultadoDeAccion = { ok: true; editedAt?: string } | { ok: false; motivo: string };

/** El acuse de editar o eliminar para todos. */
export function resultadoDeAccion(acuse: unknown): ResultadoDeAccion {
  const respuesta = (acuse ?? {}) as { ok?: boolean; editedAt?: unknown; motivo?: unknown };
  if (respuesta.ok === true) return typeof respuesta.editedAt === 'string' ? { ok: true, editedAt: respuesta.editedAt } : { ok: true };
  if (respuesta.ok === false && typeof respuesta.motivo === 'string') return { ok: false, motivo: respuesta.motivo };
  return { ok: false, motivo: 'No se pudo. Revisa tu conexión.' };
}

/** `msg.edit` o `msg.delete` con acuse. Sin socket: falla, no se encola (es sobre algo ya enviado). */
export async function accionPorSocket(
  socket: Socket | null,
  evento: 'msg.edit' | 'msg.delete' | 'msg.react',
  frame: { chatId: string; seq: number; body?: string; emoji?: string | null }
): Promise<ResultadoDeAccion> {
  if (!socket?.connected) return { ok: false, motivo: 'Sin conexión. Inténtalo cuando vuelva la red.' };
  try {
    return resultadoDeAccion(await socket.timeout(ESPERA_DEL_ACUSE_MS).emitWithAck(evento, frame));
  } catch {
    return resultadoDeAccion(undefined);
  }
}

/** The MSN nudge (backlog 3): straight to the server, not queued (it means something only now). */
export const sendNudgeBySocket = (socket: Socket | null, chatId: string) => sendFunBySocket(socket, chatId, { kind: 'zumbido' }, 'el zumbido');
/** A wink (José, 21/10), the same way. */
export const sendWinkBySocket = (socket: Socket | null, chatId: string, wink: WinkId) => sendFunBySocket(socket, chatId, { kind: 'guino', wink }, 'el guiño');

async function sendFunBySocket(socket: Socket | null, chatId: string, payload: { kind: 'zumbido' } | { kind: 'guino'; wink: WinkId }, what: string): Promise<ResultadoDeAccion> {
  if (!socket?.connected) return { ok: false, motivo: `Sin conexión: ${what} no salió.` };
  try {
    return resultadoDeAccion(await socket.timeout(ESPERA_DEL_ACUSE_MS).emitWithAck('msg.send', { chatId, clientKey: crypto.randomUUID(), ...payload }));
  } catch {
    return resultadoDeAccion(undefined);
  }
}

import { io, type Socket } from 'socket.io-client';

/**
 * El socket de la app. Un ÚNICO socket para toda la sesión: abrir uno por
 * pantalla multiplica reconexiones y deja eventos huérfanos al navegar.
 *
 * La reconexión la maneja socket.io (backoff propio); lo nuestro es lo que pasa
 * DESPUÉS de reconectar, que es sincronizar por cursor (`sync.pull`).
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';

export type ServerMessage = {
  _id: string;
  chatId: string;
  seq: number;
  senderId: string;
  clientKey: string;
  kind: string;
  body?: string;
  /** El sobre cifrado, en chats secretos (F9). Llega en vez de `body`. */
  envelope?: { v: 1; nonce: string; ciphertext: string };
  media?: { mediaId: string; thumbUrl?: string; mime?: string };
  at: string;
};

export type SendAck =
  | { ok: true; seq: number; duplicate: boolean }
  | { ok: false; status?: number; message?: string };

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  socket?.disconnect();
  socket = io(BASE_URL, {
    auth: { token },
    transports: ['websocket'],
    // Sin techo de reintentos: el teléfono puede estar horas sin señal y tiene
    // que reconectar solo cuando vuelva.
    reconnection: true,
    reconnectionDelayMax: 30_000,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

/**
 * Envía por el socket con ack. Traduce a las etiquetas del outbox: lo que el
 * motor puro entiende, no lo que socket.io devuelve.
 */
export async function sendOverSocket(frame: {
  chatId: string;
  clientKey: string;
  body?: string;
  envelope?: { v: 1; nonce: string; ciphertext: string };
  kind?: string;
}): Promise<
  | { status: 'sent'; seq: number }
  | { status: 'duplicate'; seq: number }
  | { status: 'rejected'; httpStatus: number; message?: string }
  | { status: 'unauthorized' }
  | { status: 'unreachable' }
> {
  const live = socket;
  if (!live?.connected) return { status: 'unreachable' };
  try {
    const ack = (await live.timeout(12_000).emitWithAck('msg.send', frame)) as SendAck;
    if (ack.ok) return ack.duplicate ? { status: 'duplicate', seq: ack.seq } : { status: 'sent', seq: ack.seq };
    if (ack.status === 401) return { status: 'unauthorized' };
    return { status: 'rejected', httpStatus: ack.status ?? 500, message: ack.message };
  } catch {
    // Timeout del ack: NO es un rechazo — el mensaje puede haber llegado. Se
    // reintenta, y la idempotencia por clientKey evita el duplicado.
    return { status: 'unreachable' };
  }
}

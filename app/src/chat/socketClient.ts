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
  media?: {
    mediaId: string;
    /** La miniatura, para la burbuja. */
    thumbUrl?: string;
    /** El archivo COMPLETO: es lo que abre el visor y lo que se guarda. */
    url?: string;
    mime?: string;
    /** El nombre original y el tamaño: un documento ES su nombre. */
    fileName?: string;
    sizeBytes?: number;
    /** Duración de una nota de voz en ms. */
    durationMs?: number;
  };
  /**
   * El aviso de un cambio del grupo (`kind: 'system'`). Trae el EVENTO y con
   * qué resolver los nombres; la frase la arma la app con la agenda del
   * teléfono. `body` es el respaldo, con los nombres que conoce el server.
   */
  system?: {
    evento: string;
    targetId?: string;
    valor?: string;
    quien?: { phone?: string; name?: string };
    aQuien?: { phone?: string; name?: string };
  };
  /**
   * Cuándo se borró, si se borró. Con esto puesto, `body`, `envelope` y `media`
   * NO vienen: el server los vacía de verdad. La app muestra la lápida.
   */
  deletedAt?: string;
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

/**
 * Pausar el socket al ir a segundo plano, SIN destruirlo.
 *
 * José, 30/08/2026: «nunca recibí la notificación de que Wilson me envió
 * mensajes». La causa: con la app en background pero el socket vivo, el server
 * lo veía «en línea» y NO mandaba push —los push van solo a quien no tiene
 * socket—. Al desconectar, el server lo marca offline y el mensaje siguiente
 * entra por FCM.
 *
 * `disconnect()` y NO `disconnectSocket()`: se conserva la MISMA instancia con
 * todos sus listeners, así que `resume` reabre sin que las pantallas montadas
 * pierdan su referencia.
 */
export function pauseSocket(): void {
  socket?.disconnect();
}

export function resumeSocket(): void {
  if (socket && !socket.connected) socket.connect();
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

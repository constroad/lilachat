import type { LiveLocation } from '@lilachat/shared';
import type { BotCard } from '@lilachat/shared';
import type { MencionEnMensaje, MessageRef, ResumenDeHiloEnCliente, Reaccion } from '@lilachat/shared';
import { avisarTarjeta, refrescarTodas } from '@lilachat/shared';
import { io, type Socket } from 'socket.io-client';
import { pausaDelSocket, queHacerConElSocket, type PausaDelSocket } from './servicioDeConexion';
import { registrarPerf } from '../diagnostico/diagnostico';
import { answerAgendaRequest, answerFullAgendaRequest } from '../contacts/webAgendaRelay';
import { listenPresence } from './presenceStore';
import { listenPresenceStatus } from './presenceStatus';
import { BUILD_HEADER, UPDATE_REQUIRED_STATUS, buildHeader, reportStatus } from '../api/appBuild';

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
  /** A wink's id (kind `guino`, José 21/10). */
  wink?: string;
  /** A shared contact (kind `contact`, pending 9): `userId` when that number is on Lilachat. */
  contact?: { name: string; phone: string; userId?: string };
  /** A shared location (kind `location`, pending 11). */
  location?: LiveLocation;
  /** A bot's card (`specs/BOTS-API.spec.md` §b): `body` carries its summary. */
  card?: BotCard;
  /** An app's answer sent to the channel by who asked: «José usó /clima» on top. */
  sharedBy?: { name: string; command: string };
  /** El sobre cifrado, en chats secretos (F9). Llega en vez de `body`. */
  envelope?: { v: 1; nonce: string; ciphertext: string };
  /** La encuesta o el evento que publica este mensaje (18/10): se dibuja como tarjeta. */
  ref?: MessageRef;
  /** Las @menciones del texto (18/10): se dibujan con el nombre que TÚ le tienes. */
  menciones?: MencionEnMensaje[];
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
    /** La forma de una foto o un video (FL9); sin ella, el cuadrado de 220. */
    width?: number;
    height?: number;
    /** La onda de una nota de voz (FL9); sin ella, la línea de siempre. */
    onda?: number[];
    /** An animated sticker of my own (pending 37). */
    animated?: boolean;
    /** Sent together with other photos (pending 12): drawn as one card. */
    album?: string;
    /** Duración de una nota de voz en ms. */
    durationMs?: number;
    /** A secret chat's photo or video still being decrypted on the phone, or one that could not be (pending 67). */
    sealed?: 'opening' | 'failed';
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
  /** R31/10-B6: when it disappears; past it nothing is drawn. */
  disappearsAt?: string;
  /** A qué mensaje responde, si es una respuesta. */
  replyToSeq?: number;
  /** E3: respuesta en el hilo de este `seq`; `enElChat` = se ve también en el chat. */
  hiloDe?: number;
  enElChat?: boolean;
  /** En la raíz: el resumen de su hilo (cuántas, la última, quiénes). */
  hilo?: ResumenDeHiloEnCliente;
  /** Reacciones (20/10): una por persona, en el orden en que llegaron. */
  reacciones?: Reaccion[];
  /** Se editó (José, 17/10/2026): la burbuja dice «Editado». */
  editedAt?: string;
  at: string;
};

export type SendAck =
  | { ok: true; seq: number; duplicate: boolean }
  | { ok: false; status?: number; message?: string };

let socket: Socket | null = null;

/** Quien quiere enterarse de CADA conexión, sin importar qué pantalla está abierta. */
const alConectarListeners = new Set<() => void>();

/** Se llama en cada `connect` del socket (el primero y cada reconexión). */
export function alConectar(listener: () => void): () => void {
  alConectarListeners.add(listener);
  return () => alConectarListeners.delete(listener);
}

/** The socket says its build too: `build` in its auth, read by the server's handshake check. */
function socketBuild(): { build?: string } {
  const header = buildHeader();
  return header[BUILD_HEADER] ? { build: header[BUILD_HEADER] } : {};
}

export function connectSocket(token: string): Socket {
  const decision = queHacerConElSocket(socket);
  if (socket && decision !== 'crear') {
    // El arranque entra con el JWT guardado y el refresh trae uno nuevo: el
    // socket se queda, y su próxima conexión usa el token vigente.
    socket.auth = { token, ...socketBuild() };
    // Pausado: se reconecta el MISMO, con todos sus oyentes (FL8). Antes se
    // reemplazaba y las llamadas de la sesión quedaban escuchando el viejo.
    if (decision === 'reconectar') socket.connect();
    return socket;
  }
  socket = io(BASE_URL, {
    auth: { token, ...socketBuild() },
    transports: ['websocket'],
    // Sin techo de reintentos: el teléfono puede estar horas sin señal y tiene
    // que reconectar solo cuando vuelva.
    reconnection: true,
    reconnectionDelayMax: 30_000,
  });
  // Below LilaStore's minimum the server refuses the socket (backlog 32): the update hook checks at once.
  socket.on('connect_error', (error: Error) => {
    if (error.message === 'update_required') reportStatus(UPDATE_REQUIRED_STATUS);
  });
  socket.on('connect', () => {
    for (const listener of alConectarListeners) listener();
    // Lo que cambió con el socket pausado: las tarjetas montadas se vuelven a pedir.
    refrescarTodas();
  });
  // Encuestas, eventos y recordatorios del grupo en vivo (19/10).
  socket.on('ref.changed', avisarTarjeta);
  listenPresence(socket);
  listenPresenceStatus(socket);
  // The linked web asks this phone for contact names (20/10, option «b»).
  const current = socket;
  current.on('agenda.pedido', (request: { requestId?: unknown; phones?: unknown }) => void answerAgendaRequest(current, request));
  current.on('agenda.pedidoTodo', (request: { requestId?: unknown }) => void answerFullAgendaRequest(current, request));
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
  aplicarPausa('pausar');
}

export function resumeSocket(): void {
  aplicarPausa('reanudar');
  if (socket && !socket.connected) socket.connect();
}

/** En plena llamada la pausa espera (FL11): por el socket llega que el otro colgó. */
let pausa: PausaDelSocket = { enLlamada: false, pausaPendiente: false };

function aplicarPausa(evento: Parameters<typeof pausaDelSocket>[1]): void {
  const resultado = pausaDelSocket(pausa, evento);
  pausa = resultado.estado;
  if (resultado.desconectar) socket?.disconnect();
}

/** La llamada empieza o termina: mientras dure, ir al fondo no pausa el socket. */
export function sostenerPorLlamada(activa: boolean): void {
  aplicarPausa(activa ? 'llamada' : 'fin-de-llamada');
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
  replyToSeq?: number;
  menciones?: MencionEnMensaje[];
  hiloDe?: number;
  enElChat?: boolean;
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
    const inicio = Date.now();
    const ack = (await live.timeout(12_000).emitWithAck('msg.send', frame)) as SendAck;
    // Línea base de FL0 (spec §45): cuánto tarda el server en confirmar.
    if (ack.ok && !ack.duplicate) void registrarPerf('ack-envio', Date.now() - inicio);
    if (ack.ok) return ack.duplicate ? { status: 'duplicate', seq: ack.seq } : { status: 'sent', seq: ack.seq };
    if (ack.status === 401) return { status: 'unauthorized' };
    return { status: 'rejected', httpStatus: ack.status ?? 500, message: ack.message };
  } catch {
    // Timeout del ack: NO es un rechazo — el mensaje puede haber llegado. Se
    // reintenta, y la idempotencia por clientKey evita el duplicado.
    return { status: 'unreachable' };
  }
}

/**
 * Cliente del lilachat-server. Sin imports de react-native (testeable en
 * vitest); el `fetch` se puede inyectar en los tests.
 *
 * `EXPO_PUBLIC_API_URL` se hornea al compilar (lección Timón: un release con el
 * .env de dev sale apuntando al emulador y falla con wifi andando — el script
 * de release lo fija y lo verifica dentro del binario).
 */
import type { ChatList, DestacadoEnLista, PresenceMode, NotificationLevel, ResumenDeHiloEnCliente, VistaDelFijado, VistaPreviaDeEnlace } from '@lilachat/shared';
import type { BigFile, StorageReport } from '@lilachat/shared';
import type { ServerMessage } from '../chat/socketClient';
import { unSoloPedido } from './pedidoUnico';
import { buildHeader, reportStatus } from './appBuild';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';
const TIMEOUT_MS = 15_000;

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | 'network'; message?: string };

type FetchLike = typeof fetch;

async function post<T>(
  route: string,
  body: Record<string, unknown>,
  fetchImpl: FetchLike = fetch
): Promise<ApiResult<T>> {
  try {
    const response = await fetchImpl(`${BASE_URL}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...buildHeader() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      reportStatus(response.status);
      return {
        ok: false,
        status: response.status,
        message: typeof payload.message === 'string' ? payload.message : undefined,
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 'network' };
  }
}

/** POST/DELETE autenticado, con o sin cuerpo. Comparte forma con `get`/`post`. */
async function authed<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  route: string,
  token: string,
  body?: Record<string, unknown>
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${BASE_URL}${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...buildHeader(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      reportStatus(response.status);
      return {
        ok: false,
        status: response.status,
        message: typeof payload.message === 'string' ? payload.message : undefined,
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 'network' };
  }
}

/** El perfil propio (FL9): la foto viene ABSOLUTA, o `null` sin foto. */
export type PerfilPropio = { name: string | null; phone: string; avatarUrl: string | null };

export const guardarNombreDePerfil = (name: string, token: string) =>
  authed<{ perfil: PerfilPropio }>('PUT', '/api/me/perfil', token, { name });

export const quitarFotoDePerfil = (token: string) =>
  authed<{ perfil: PerfilPropio }>('DELETE', '/api/me/perfil/foto', token);

/** Shares a contact in the chat (pending 9); the `clientKey` keeps a retry from duplicating it. */
export const shareContact = (token: string, chatId: string, contact: { name: string; phone: string; clientKey: string; replyToSeq?: number }) =>
  authed<{ duplicate: boolean }>('POST', `/api/chats/${chatId}/contacts`, token, contact);

/** «Almacenamiento» (pending 13): what each of my chats weighs and the files over 5 MB. */
export const getStorageReport = (token: string) => get<StorageReport>('/api/me/storage', token);

/** Every file of one chat, biggest first. */
export const getChatStorageFiles = (token: string, chatId: string) => get<{ files: BigFile[] }>(`/api/me/storage/chats/${chatId}/files`, token);

/** Shares where I am in the chat (pending 11); the `clientKey` keeps a retry from duplicating it. */
export const shareLocation = (token: string, chatId: string, location: { lat: number; lng: number; accuracy?: number; clientKey: string }) =>
  authed<{ duplicate: boolean }>('POST', `/api/chats/${chatId}/locations`, token, location);

/** My lists of chats (pending 45): the same ones the web shows. */
export const listChatLists = (token: string) => get<{ lists: ChatList[] }>('/api/chat-lists', token);

export const createChatList = (token: string, name: string, chatIds: string[]) =>
  authed<{ list: ChatList; lists?: ChatList[] }>('POST', '/api/chat-lists', token, { name, chatIds });

export const updateChatList = (token: string, listId: string, change: { name?: string; add?: string[]; remove?: string[] }) =>
  authed<{ list: ChatList; lists?: ChatList[] }>('PATCH', `/api/chat-lists/${listId}`, token, change);

export const deleteChatList = (token: string, listId: string) => authed<{ ok: true }>('DELETE', `/api/chat-lists/${listId}`, token);

/** A call link of a 1:1 chat (pending 42), and what one opens: its chat, kind and the other person's name. */
export const createCallLink = (token: string, chatId: string, video: boolean) => authed<{ url: string }>('POST', `/api/chats/${chatId}/call-link`, token, { video });

export const openCallLink = (token: string, linkToken: string) => get<{ chatId: string; video: boolean; name: string | null }>(`/api/call-links/${encodeURIComponent(linkToken)}`, token);

/** My presence and «últ. vez» (pending 15): what the others see. */
export type PresencePrefs = { mode: PresenceMode; lastSeenHidden: boolean };

export const readPresence = (token: string) => get<PresencePrefs>('/api/me/presence', token);

export const savePresence = (token: string, prefs: PresencePrefs) => authed<PresencePrefs>('PUT', '/api/me/presence', token, prefs);

export type Programado = { id: string; chatId: string; body: string; sendAt: string };

/** Programar un mensaje para que se envíe solo a `sendAt` (ISO). */
export const programarMensaje = (
  token: string,
  chatId: string,
  body: string,
  sendAt: string,
  clientKey: string
) => authed<Programado>('POST', `/api/chats/${chatId}/schedule`, token, { body, sendAt, clientKey });

export const listarProgramados = (token: string) =>
  get<{ programados: Programado[] }>('/api/chats/scheduled', token);

export const cancelarProgramado = (token: string, id: string) =>
  authed<{ cancelado: boolean }>('DELETE', `/api/chats/scheduled/${id}`, token);

export type AutoReply = { enabled: boolean; text: string };

/** Auto-respuesta de ausente (F11): leer y guardar el ajuste del usuario. */
export const leerAutoReply = (token: string) =>
  get<{ autoReply: AutoReply }>('/api/me/auto-reply', token);

export const guardarAutoReply = (token: string, enabled: boolean, text: string) =>
  authed<{ autoReply: AutoReply }>('PUT', '/api/me/auto-reply', token, { enabled, text });

export type EstadoDeRespaldos = {
  disco: { estado: 'montado' | 'ausente' | 'colgado'; libres: number | null; total: number | null };
  copia: { ultimaEn?: string; verificadaEn?: string; ok?: boolean; fallo?: string } | null;
  cantidad: number;
  ultimo: { nombre: string; huella: string; bytes: number; creadoEn: string } | null;
};

/** Respaldos de conversaciones (F12.1): el server es un depósito de archivos cifrados. */
export const estadoDeRespaldos = (token: string) => get<EstadoDeRespaldos>('/api/respaldos/estado', token);

export const ultimoRespaldo = (token: string) =>
  get<{ respaldo: EstadoDeRespaldos['ultimo'] }>('/api/respaldos/ultimo', token);

/** Pending 83: the phone tells the server why it did not back up (only «no key yet» for now). */
export const reportBackupAttempt = (token: string, reason: 'sin_passphrase') => authed<Record<string, never>>('POST', '/api/respaldos/intento', token, { motivo: reason });

/** Antes de subir: qué huellas le faltan al server, para no gastar datos en lo que ya está. */
export const huellasDeRespaldoQueFaltan = (token: string, huellas: string[]) =>
  authed<{ faltan: string[]; invalidas: string[] }>('POST', '/api/respaldos/huellas', token, { huellas });

export const requestOtp = (phone: string, preferEmail = false, fetchImpl?: FetchLike) =>
  post<{ message: string }>('/api/auth/otp/request', { phone, preferEmail }, fetchImpl);

export const verifyOtp = (
  params: { phone: string; code: string; deviceId: string; name?: string },
  fetchImpl?: FetchLike
) =>
  post<{
    deviceSecret: string;
    jwt: string;
    user: { id: string; name: string | null; phone: string; avatarUrl?: string | null };
  }>(
    '/api/auth/otp/verify',
    params,
    fetchImpl
  );

export type ChatSummary = {
  id: string;
  /** `notas`: un borrador, un chat solo contigo y con nombre (19/10). */
  kind: 'direct' | 'group' | 'notas';
  name?: string;
  /** A chat of a company space, and a channel there (E1/E2): it opens in the Slack format. */
  workspaceId?: string;
  channel?: { visibility: 'public' | 'private' };
  /** El chat contigo («Tú · Envíate un mensaje», 20/10). */
  propio?: boolean;
  /** El teléfono del OTRO, solo en 1:1: con él se busca su nombre en tu agenda. */
  phone?: string;
  memberIds: string[];
  /** Los otros miembros cuyo acuse cuenta para mis checks (sin mí ni Lila; FL8). */
  acuseDe?: string[];
  lastSeq: number;
  unread: number;
  lastMessage: {
    seq: number;
    body?: string;
    kind?: string;
    senderId: string;
    at: string;
    /** Borrado para todos (19/10): la vista previa lo dice y no lleva checks. */
    deletedAt?: string;
    /** E3: fue una respuesta en un hilo. */
    /** A wink's id: the list plays its sound (José, 21/10). */
    wink?: string;
    hiloDe?: number;
    /** The file's type: a GIF says «GIF», not «Foto» (pending 53). */
    mime?: string;
    /** The small image beside the preview: sticker, photo, GIF or video frame (pending 57). */
    thumb?: string;
    /** El aviso de grupo, para resolver el nombre con la agenda del teléfono. */
    system?: {
      evento: string;
      targetId?: string;
      valor?: string;
      quien?: { phone?: string; name?: string };
      aQuien?: { phone?: string; name?: string };
    };
  } | null;
  othersReadSeq: number;
  othersDeliveredSeq: number;
  /** Hasta dónde leí yo (19/10): el divisor de no leídos va justo después. Un server viejo no lo manda. */
  readSeq?: number;
  /** Chat secreto (F9). */
  encrypted?: boolean;
  /** La foto del grupo, absoluta. Sin foto se dibuja la inicial. */
  avatarUrl?: string;
  /** Silenciado por mí: la fila lo marca y no me llega push. */
  /** Nudges and winks switched on by an admin of the group (José, 21/10). */
  funAllowed?: boolean;
  muted?: boolean;
  /** Fijado por mí: va arriba en la lista. */
  pinned?: boolean;
  /** Archivado por mí (FL9): vive en «Archivados». */
  archived?: boolean;
  /** Marcado por mí como no leído (FL9): el punto sin número. */
  markedUnread?: boolean;
  /** Mensajes fijados arriba del chat (19/10), el más reciente primero. */
  fijados?: FijadoEnLista[];
};

/** Un fijado como lo manda la lista: con su vista previa (sin texto en un chat secreto). */
export type FijadoEnLista = {
  seq: number;
  por: string;
  en: string;
  hasta: string;
  vista: VistaDelFijado;
};

/** Lo que cada uno ajusta para sí en un chat (FL9 suma archivar y no leído). */
export type AjustesDeChat = { muted?: boolean; pinned?: boolean; archived?: boolean; markedUnread?: boolean; avisos?: NotificationLevel };

async function get<T>(route: string, token: string, fetchImpl: FetchLike = fetch): Promise<ApiResult<T>> {
  try {
    const response = await fetchImpl(`${BASE_URL}${route}`, {
      headers: { Authorization: `Bearer ${token}`, ...buildHeader() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      reportStatus(response.status);
      return {
        ok: false,
        status: response.status,
        message: typeof payload.message === 'string' ? payload.message : undefined,
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 'network' };
  }
}

/**
 * La lista de chats. Dos pedidos iguales en vuelo van UNA vez al server (FL4:
 * al arrancar se pedía 6 veces). Con `fetchImpl` (los tests) va siempre.
 */
export const listChats = (token: string, fetchImpl?: FetchLike) =>
  fetchImpl
    ? get<{ chats: ChatSummary[] }>('/api/chats', token, fetchImpl)
    : unSoloPedido(`chats:${token}`, () => get<{ chats: ChatSummary[] }>('/api/chats', token));

export type ResultadoBusqueda = {
  chatId: string;
  messageId: string;
  seq: number;
  body: string;
  senderId: string;
  createdAt: string;
};

/** Buscar texto dentro de las conversaciones. El server scopea por membresía. */
export const buscarMensajes = (token: string, q: string, fetchImpl?: FetchLike) =>
  get<{ resultados: ResultadoBusqueda[] }>(
    `/api/chats/search?q=${encodeURIComponent(q)}`,
    token,
    fetchImpl
  );

/**
 * Silenciar / fijar / archivar / marcar no leído un chat, para mí. Lo usa la
 * selección múltiple de la lista.
 * Devuelve solo si salió bien; el error se ignora arriba porque es un ajuste,
 * no una acción destructiva —a lo sumo hay que reintentar—.
 */
export async function cambiarAjustesDeChat(
  chatId: string,
  token: string,
  cambios: AjustesDeChat
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/chats/${chatId}/ajustes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...buildHeader() },
      body: JSON.stringify(cambios),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** La tarjeta de un enlace del chat (FL13d). `null`: la página no tiene. */
export const pedirVistaPrevia = (url: string, token: string) =>
  get<{ vistaPrevia: VistaPreviaDeEnlace | null }>(`/api/enlaces/vista-previa?url=${encodeURIComponent(url)}`, token);

/** Un miembro en la «Info» de un mensaje propio (FL9): su estado, sin hora. */
export type MiembroDeInfo = { id: string; name: string | null; phone: string | null; estado: 'pending' | 'sent' | 'delivered' | 'read' };

export const infoDeMensaje = (chatId: string, seq: number, token: string) =>
  get<{ miembros: MiembroDeInfo[] }>(`/api/chats/${chatId}/messages/${seq}/info`, token);

/** «Eliminar chat» para mí (FL9d). Devuelve solo si salió bien. */
export async function borrarChatParaMi(chatId: string, token: string): Promise<boolean> {
  const respuesta = await authed<{ ok: boolean }>('POST', `/api/chats/${chatId}/borrar-para-mi`, token);
  return respuesta.ok;
}

/**
 * Salir de un grupo. Lo usa la selección múltiple («Salir» solo aparece si toda
 * la selección son grupos). El server promueve a otro admin si me voy siendo el
 * último. Devuelve solo si salió bien; el caller recarga la lista.
 */
export async function leaveChat(chatId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/chats/${chatId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, ...buildHeader() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Al cerrar sesión: el server deja de mandar push a ESTE teléfono (FL8). Sin
 * esto el token quedaba en el device y un teléfono deslogueado seguía
 * recibiendo los avisos de la cuenta. Es la misma ruta que usa la web; va por
 * `deviceId` de la sesión, no por plataforma. Plazo corto: si no hay red, la
 * sesión se cierra igual.
 */
export async function olvidarPushDeEsteTelefono(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/push/subscribe`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, ...buildHeader() },
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Los mensajes ANTERIORES a uno dado — el scroll hacia arriba del chat.
 *
 * El resto de la conversación llega por el socket con cursores; esto es solo
 * para el histórico viejo, que el sync no arrastra a propósito: traer años de
 * mensajes al abrir un chat es justo lo que hace que una app se sienta pesada.
 */
/** A window around an old message, or a page down from one (pending 44): `around`, `afterSeq` or `beforeSeq`. */
export const messageWindowPage = (params: { chatId: string; query: string; limit: number }, token: string, fetchImpl?: FetchLike) =>
  get<{ messages: unknown[]; lastSeq?: number; hasOlder?: boolean; hasNewer?: boolean }>(`/api/chats/${params.chatId}/messages?${params.query}&limit=${params.limit}`, token, fetchImpl);

export const listOlderMessages = (
  params: { chatId: string; beforeSeq?: number; limit: number },
  token: string,
  fetchImpl?: FetchLike
) =>
  // Sin `beforeSeq` trae la ÚLTIMA página, que es lo que hace falta para sanear
  // la caché al abrir el chat. `lastSeq` viene con ella: es el tope real del
  // chat en ese instante.
  get<{ messages: unknown[]; lastSeq?: number }>(
    `/api/chats/${params.chatId}/messages?limit=${params.limit}` +
      (params.beforeSeq ? `&beforeSeq=${params.beforeSeq}` : ''),
    token,
    fetchImpl
  );

export const refreshSession = (
  params: { deviceId: string; deviceSecret: string },
  fetchImpl?: FetchLike
) =>
  post<{ jwt: string; user?: { id: string; name: string | null; phone: string; avatarUrl?: string | null } }>(
    '/api/auth/session',
    params,
    fetchImpl
  );

/** Una web vinculada con el QR (W5): sin secretos, solo lo que se muestra. */
export type DispositivoVinculado = { deviceId: string; nombre: string; ultimoUso: string | null; vinculadoEn: string | null };

/** El nombre del navegador de un QR escaneado, antes de aprobar (W5). */
export const consultarVinculacion = (token: string, codigo: string) =>
  authed<{ nombre: string }>('POST', '/api/vinculos/consultar', token, { token: codigo });

export const aprobarVinculacion = (token: string, codigo: string) =>
  authed<{ nombre: string }>('POST', '/api/vinculos/aprobar', token, { token: codigo });

export const listarVinculados = (token: string) => get<{ dispositivos: DispositivoVinculado[] }>('/api/vinculos', token);

export const cerrarVinculado = (token: string, deviceId: string) =>
  authed<Record<string, never>>('DELETE', `/api/vinculos/${encodeURIComponent(deviceId)}`, token);

/** Fijar un mensaje arriba del chat (19/10): `24h`, `7d` o `30d`. */
export const fijarMensajeEnChat = (token: string, chatId: string, seq: number, duracion: string) =>
  authed<{ ok: true }>('POST', `/api/chats/${chatId}/fijados`, token, { seq, duracion });

export const desfijarMensajeEnChat = (token: string, chatId: string, seq: number) =>
  authed<{ ok: true }>('DELETE', `/api/chats/${chatId}/fijados/${seq}`, token);

/** Reenviar una foto o un archivo (auditoría 19/10): el server copia la referencia y el pie. */
export const reenviarMensajeA = (token: string, haciaChatId: string, origen: { desde: string; seq: number; clientKey: string }) =>
  authed<{ message: unknown; duplicate: boolean }>('POST', `/api/chats/${haciaChatId}/reenviar`, token, origen);

/** E3: el resumen de cada raíz del chat (el chip al día tras estar desconectado). */
export const hilosDelChat = (token: string, chatId: string) =>
  get<{ hilos: { raiz: number; hilo: ResumenDeHiloEnCliente }[] }>(`/api/chats/${chatId}/hilos`, token);

/** E3: un hilo entero, al abrirlo (trae lo que el teléfono no tenía guardado). */
export const hiloCompleto = (token: string, chatId: string, raiz: number) =>
  get<{ raiz: ServerMessage; respuestas: ServerMessage[] }>(`/api/chats/${chatId}/hilos/${raiz}`, token);

/** «Destacados» (20/10): la estrella personal. Los `seq` de un chat, para la estrella de cada burbuja. */
export const leerDestacadosDelChat = (token: string, chatId: string) => get<{ seqs: number[] }>(`/api/chats/${chatId}/destacados`, token);
export const destacarMensaje = (token: string, chatId: string, seq: number) => authed<Record<string, never>>('PUT', `/api/chats/${chatId}/destacados/${seq}`, token);
export const quitarDestacado = (token: string, chatId: string, seq: number) => authed<Record<string, never>>('DELETE', `/api/chats/${chatId}/destacados/${seq}`, token);
/** Todos los míos, del más reciente (la lista global). */
export const listarDestacados = (token: string) => get<{ destacados: DestacadoEnLista[] }>('/api/destacados', token);

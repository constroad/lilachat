import { acuseDelGrupo } from '@lilachat/shared';
import type { ChatSummary } from '../api/client';

/** Lo que trae un `msg.new` y le importa a la lista. */
export type MensajeEnVivo = {
  chatId: string;
  seq: number;
  senderId: string;
  kind?: string;
  body?: string;
  at: string;
  system?: NonNullable<ChatSummary['lastMessage']>['system'];
};

/**
 * Aplica un `msg.new` a la lista de chats, sin ir al server.
 *
 * Antes cada mensaje entrante recargaba la lista entera por HTTP (tres viajes a
 * la base más uno por chat) para cambiar una fila. Ahora se cambia esa fila.
 *
 * Devuelve `null` si el chat no está en la lista: es una conversación nueva y
 * solo el server sabe su nombre y sus miembros. Un duplicado devuelve la MISMA
 * lista, y los chats que no cambian conservan su referencia: así la fila
 * memoizada no se vuelve a dibujar.
 */
export function aplicarMensajeALista(
  chats: ChatSummary[],
  mensaje: MensajeEnVivo,
  yo: string,
  /** El chat que se está mirando: sus mensajes se leen al llegar. */
  chatAbierto: string | null = null
): ChatSummary[] | null {
  const indice = chats.findIndex((chat) => chat.id === mensaje.chatId);
  if (indice === -1) return null;
  const actual = chats[indice];
  if (!actual || mensaje.seq <= actual.lastSeq) return chats;

  const yaLeido = String(mensaje.senderId) === yo || mensaje.chatId === chatAbierto;
  const actualizado: ChatSummary = {
    ...actual,
    lastSeq: mensaje.seq,
    unread: yaLeido ? actual.unread : actual.unread + 1,
    lastMessage: {
      seq: mensaje.seq,
      // Un sobre cifrado no trae `body`: la vista previa queda sin texto.
      body: mensaje.body,
      kind: mensaje.kind,
      senderId: String(mensaje.senderId),
      at: mensaje.at,
      system: mensaje.system,
    },
  };
  return chats.map((chat, i) => (i === indice ? actualizado : chat));
}

/**
 * Al volver de un chat, su contador queda en 0. Antes la lista se remontaba y
 * lo traía del server; con la lista viva debajo (FL1) se corrige acá.
 */
export function marcarLeido(chats: ChatSummary[], chatId: string): ChatSummary[] {
  const indice = chats.findIndex((chat) => chat.id === chatId);
  const actual = chats[indice];
  // Abrir el chat también quita la marca de «no leído» (FL9; el server igual).
  if (!actual || (actual.unread === 0 && !actual.markedUnread)) return chats;
  return chats.map((chat, i) => (i === indice ? { ...actual, unread: 0, markedUnread: false } : chat));
}

/**
 * El punto verde de una fila (FL10, auditoría §46.3): solo en un 1:1, como
 * WhatsApp. En un grupo, con varios conectados, sería ruido permanente.
 */
export function puntoEnLinea(chat: Pick<ChatSummary, 'kind' | 'memberIds'>, yo: string, enLinea: ReadonlySet<string>): boolean {
  return chat.kind === 'direct' && chat.memberIds.some((id) => id !== yo && enLinea.has(id));
}

/** Una carga de hace menos que esto ya está al día (ms). */
const CARGA_RECIENTE_MS = 3000;

/**
 * Al conectar el socket, ¿recargar la lista? (FL4). Solo si la última carga
 * buena no es reciente: al arrancar, la carga del montaje y la primera
 * conexión llegaban juntas y eran dos pedidos iguales.
 */
export function debeRecargarAlConectar(params: { ultimaCarga: number | null; ahora: number }): boolean {
  return params.ultimaCarga === null || params.ahora - params.ultimaCarga > CARGA_RECIENTE_MS;
}

/** Un `receipt` del socket, tal como llega. */
export type AcuseEnVivo = { chatId?: unknown; userId?: unknown; readSeq?: unknown; deliveredSeq?: unknown };
/** Lo que cada miembro acusó en vivo, por chat: el mínimo de un grupo lo necesita. */
export type CursoresEnVivo = Map<string, { leido: Map<string, number>; entregado: Map<string, number> }>;

const subir = (mapa: Map<string, number>, quien: string, seq: unknown) => {
  if (typeof seq === 'number' && seq > (mapa.get(quien) ?? 0)) mapa.set(quien, seq);
};

const calcular = (mapa: Map<string, number>, base: number, acuseDe?: readonly string[]) =>
  acuseDe ? acuseDelGrupo({ otros: acuseDe, porMiembro: mapa, base }) : Math.max(base, ...mapa.values());

/**
 * Un acuse en vivo, aplicado a la fila (José, 19/10: «2 checks en el chat, 1
 * en la lista, y al volver a entrar 1»). Antes solo el chat abierto escuchaba
 * los acuses: la lista se quedaba con los del server y el chat, al volver,
 * partía de esa base vieja. Misma regla que el chat (`useAcuses`): en un
 * grupo manda el menor, y quien no acusó en vivo vale lo que dijo el server.
 * Si el check no cambia, devuelve la MISMA lista.
 */
export function aplicarAcuseALista(chats: ChatSummary[], acuse: AcuseEnVivo, yo: string, cursores: CursoresEnVivo): ChatSummary[] {
  const { chatId, userId } = acuse;
  if (typeof chatId !== 'string' || typeof userId !== 'string') return chats;
  const indice = chats.findIndex((chat) => chat.id === chatId);
  const actual = chats[indice];
  if (!actual) return chats;
  if (userId === yo) return aplicarMiAcuse(chats, indice, actual, acuse.readSeq);
  const delChat = cursores.get(chatId) ?? { leido: new Map(), entregado: new Map() };
  cursores.set(chatId, delChat);
  subir(delChat.leido, userId, acuse.readSeq);
  subir(delChat.entregado, userId, acuse.deliveredSeq);
  const othersReadSeq = calcular(delChat.leido, actual.othersReadSeq, actual.acuseDe);
  const othersDeliveredSeq = Math.max(othersReadSeq, calcular(delChat.entregado, actual.othersDeliveredSeq, actual.acuseDe));
  if (othersReadSeq === actual.othersReadSeq && othersDeliveredSeq === actual.othersDeliveredSeq) return chats;
  return chats.map((chat, i) => (i === indice ? { ...actual, othersReadSeq, othersDeliveredSeq } : chat));
}

/**
 * MI acuse (leí en la web, o el server marcó lo mío al enviar): baja mis no
 * leídos de esa fila y quita la marca de «no leído», como hace el server.
 */
function aplicarMiAcuse(chats: ChatSummary[], indice: number, actual: ChatSummary, readSeq: unknown): ChatSummary[] {
  if (typeof readSeq !== 'number') return chats;
  const unread = Math.min(actual.unread, Math.max(0, actual.lastSeq - readSeq));
  if (unread === actual.unread && !actual.markedUnread) return chats;
  return chats.map((chat, i) => (i === indice ? { ...actual, unread, markedUnread: false } : chat));
}

/** Un `msg.edited` o `msg.deleted` del socket, tal como llega. */
export type CambioDeMensaje = { chatId?: unknown; seq?: unknown; body?: unknown };

/** La fila cuyo último mensaje es ese `seq`, o -1. */
function filaDelUltimo(chats: ChatSummary[], cambio: CambioDeMensaje): number {
  if (typeof cambio.chatId !== 'string' || typeof cambio.seq !== 'number') return -1;
  return chats.findIndex((chat) => chat.id === cambio.chatId && chat.lastMessage?.seq === cambio.seq);
}

/** Editaron el último mensaje: la vista previa dice lo nuevo (auditoría 19/10). */
export function aplicarEdicionALista(chats: ChatSummary[], cambio: CambioDeMensaje): ChatSummary[] {
  const indice = filaDelUltimo(chats, cambio);
  const actual = chats[indice];
  if (!actual?.lastMessage || typeof cambio.body !== 'string') return chats;
  const lastMessage = { ...actual.lastMessage, body: cambio.body };
  return chats.map((chat, i) => (i === indice ? { ...actual, lastMessage } : chat));
}

/** Borraron el último para todos: la vista previa dice «Se eliminó este mensaje». */
export function aplicarBorradoALista(chats: ChatSummary[], cambio: CambioDeMensaje, ahora: string): ChatSummary[] {
  const indice = filaDelUltimo(chats, cambio);
  const actual = chats[indice];
  if (!actual?.lastMessage) return chats;
  const lastMessage = { ...actual.lastMessage, body: undefined, deletedAt: ahora };
  return chats.map((chat, i) => (i === indice ? { ...actual, lastMessage } : chat));
}

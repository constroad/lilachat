import { Types } from 'mongoose';
import type { Server as SocketServer } from 'socket.io';
import type { Message } from './chatModels.js';
import { chatMemberIds, entregarAlConectar, markDelivered, marcarPropioLeido } from './chatService.js';
import { toClientMessage } from './messageView.js';
import { isOnline } from './presence.js';
import { notifyOffline } from './pushService.js';
import { broadcastReceipt } from './readPrivacy.js';

/**
 * El REPARTO de lo que pasa en un chat (salió de `socket.ts` el 20/10; el
 * socket lo re-exporta): mensajes nuevos, acuses propios, avisos y cambios.
 * Un solo camino para todo lo que crea mensajes —socket, media, auto-respuestas,
 * programados, hilos—.
 */
const userRoom = (userId: string) => `user:${userId}`;
const deviceRoom = (deviceId: string) => `device:${deviceId}`;

/**
 * El `io` vivo, para que quien cree un mensaje FUERA del socket pueda avisar.
 *
 * Existe por el 27/08/2026: una foto se sube por HTTP (`/api/media`), ese camino
 * creaba el mensaje correctamente —quedaba en la base— pero **no emitía
 * `msg.new`**, porque el emit vivía solo dentro del handler del socket. El
 * síntoma: la foto no aparecía en el chat hasta reabrirlo. Verificado mirando la
 * base (el mensaje estaba, con su `seq`) y la pantalla (no estaba).
 *
 * `null` mientras no se llamó a `attachSocket` — o sea en los tests que montan
 * la app sin socket. `avisarMensajeNuevo` no hace nada en ese caso.
 */
let ioVivo: SocketServer | null = null;

/** A message changed outside the socket (a bot replaced its card): the members see it change, without push. */
export function notifyEdited(members: readonly string[], edited: Record<string, unknown>): void {
  for (const member of members) ioVivo?.to(userRoom(member)).emit('msg.edited', edited);
}

/** `attachSocket` deja acá el servidor: desde ese momento el reparto emite. */
export function fijarServidorDelReparto(io: SocketServer): void {
  ioVivo = io;
}

/**
 * Emite `msg.new` a todos los miembros de un chat. Es la MISMA operación que
 * hace el handler del socket, extraída para que los dos caminos —texto por
 * socket, media por HTTP— avisen igual. Tenerla en un solo lugar es lo que
 * impide que la próxima forma de crear un mensaje vuelva a olvidarse del aviso.
 */
/**
 * Publicar un mensaje que ya está guardado: repartirlo por socket a todos los
 * miembros y avisar por push a los que no tienen socket. Un solo camino para
 * todo lo que crea mensajes — el socket, la media, las auto-respuestas y los
 * programados. Antes la media no mandaba push y los programados y las
 * auto-respuestas no se emitían: se veían recién al reabrir el chat.
 */
/** A message deleted outside the socket (a checklist's card): every member swaps it for the tombstone, and its thread recounts. */
export function notifyDeleted(chatId: string, seq: number, members: string[], thread?: { rootSeq: number; summary: unknown }): void {
  for (const member of members) {
    ioVivo?.to(userRoom(member)).emit('msg.deleted', { chatId, seq });
    if (thread) ioVivo?.to(userRoom(member)).emit('msg.hilo', { chatId, raiz: thread.rootSeq, hilo: thread.summary });
  }
}

/** A thread changed (a reply arrived outside the socket, like a sticker): its new summary to every member. */
export function notifyThread(chatId: string, rootSeq: number, summary: unknown, members: string[]): void {
  for (const member of members) ioVivo?.to(userRoom(member)).emit('msg.hilo', { chatId, raiz: rootSeq, hilo: summary });
}

export async function publicarMensaje(
  message: Message,
  conocidos?: string[],
  /** Lo que sale sin que el autor esté mirando (programado, auto-respuesta, aviso). */
  opciones: { soloSiAlDia?: boolean } = {}
): Promise<string[]> {
  const miembros = conocidos ?? (await chatMemberIds(message.chatId));
  await leerLoPropio(message, miembros, opciones);
  const members = await avisarMensajeNuevo(message, miembros);
  const senderId = String(message.senderId);
  // `.catch` y no `void` a secas: un rechazo sin dueño tumba los tests y
  // despierta la red de seguridad del proceso por algo que no es un error real.
  void notifyOffline({ message, members, senderId }).catch((error) =>
    console.error('[push] no se pudo avisar:', error?.message ?? error)
  );
  return members;
}

/**
 * Lo propio queda leído ANTES de repartirlo (auditoría 19/10): si se marcaba
 * después, una lista pedida en ese hueco —el teléfono que vuelve de la galería,
 * la web— contaba como sin leer el mensaje de uno mismo. Si al hacerlo quedó
 * leído algo ajeno (responder es leer), los demás lo ven en vivo.
 */
export async function leerLoPropio(message: Pick<Message, 'chatId' | 'senderId' | 'seq'>, conocidos: string[] | undefined, opciones: { soloSiAlDia?: boolean } = {}): Promise<void> {
  try {
    const antes = await marcarPropioLeido(message, opciones);
    if (antes === null || antes >= message.seq - 1) return;
    const acuse = { chatId: String(message.chatId), userId: String(message.senderId), readSeq: message.seq, deliveredSeq: message.seq };
    // R31/10: with read receipts off in a 1:1, the other only learns «entregado».
    await broadcastReceipt(String(message.chatId), String(message.senderId), acuse, (miembro, frame) => ioVivo?.to(userRoom(miembro)).emit('receipt', frame));
  } catch (error) {
    console.error('[leído] no se pudo marcar lo propio:', (error as Error)?.message ?? error);
  }
}

/** El «me llegó» de lo que estaba pendiente al conectar, a quien lo mandó (y a mis otros equipos). */
export async function avisarEntregadoAlConectar(userId: Types.ObjectId, me: string): Promise<void> {
  try {
    for (const { chatId, seq, miembros } of await entregarAlConectar(userId)) {
      for (const miembro of miembros) ioVivo?.to(userRoom(miembro)).emit('receipt', { chatId, userId: me, deliveredSeq: seq });
    }
  } catch (error) {
    console.error('[entregado] no se pudo marcar al conectar:', (error as Error)?.message ?? error);
  }
}

/** Una línea de sistema (pin, miembros, llamada): leída para quien actuó si estaba al día, sin push. */
export async function publicarAviso(message: Message, miembros?: string[]): Promise<string[]> {
  const destino = miembros ?? (await chatMemberIds(message.chatId));
  await leerLoPropio(message, destino, { soloSiAlDia: true });
  return avisarMensajeNuevo(message, destino);
}

export async function avisarMensajeNuevo(
  message: Parameters<typeof toClientMessage>[0],
  /** Los miembros, si ya se leyeron al enviar (FL4): ahorra un viaje a la base. */
  conocidos?: string[]
): Promise<string[]> {
  const members = conocidos ?? (await chatMemberIds(message.chatId));
  if (!ioVivo) return members;

  const remitente = String((message as { senderId?: unknown }).senderId ?? '');
  const chatId = String(message.chatId);
  const seq = Number((message as { seq?: unknown }).seq);

  for (const member of members) {
    ioVivo.to(userRoom(member)).emit('msg.new', toClientMessage(message));

    // A un miembro CONECTADO que no sea el autor se le acaba de ENTREGAR: se
    // marca su acuse de entrega y se avisa al remitente. Asi el doble check
    // gris aparece aunque esa persona no tenga el chat abierto — como WhatsApp.
    // El offline lo acusa su propio cliente al reconectar y hacer sync.pull.
    if (
      member !== remitente &&
      Number.isFinite(seq) &&
      seq > 0 &&
      Types.ObjectId.isValid(member) &&
      isOnline(member)
    ) {
      void markDelivered({ chatId, userId: new Types.ObjectId(member), seq })
        .then((avanzo) => {
          if (!avanzo) return;
          ioVivo?.to(userRoom(remitente)).emit('receipt', {
            chatId,
            userId: member,
            deliveredSeq: seq,
          });
        })
        .catch(() => {});
    }
  }
  return members;
}

/**
 * Avisa a una persona que un chat suyo cambió de forma (entró o salió alguien).
 *
 * No manda QUÉ cambió: manda que hay que releer. Mandar el diff obligaría a que
 * el cliente sepa aplicar cada tipo de cambio en orden, y una lista de chats que
 * se recarga sola es infinitamente más barata de mantener correcta.
 */
export function avisarCambioDeChat(userId: string, chatId: string): void {
  ioVivo?.to(userRoom(userId)).emit('chat.changed', { chatId });
}

/** Revocada una web vinculada (W5): su socket se corta en el acto. */
export function desconectarDispositivo(deviceId: string): void {
  ioVivo?.in(deviceRoom(deviceId)).disconnectSockets(true);
}

/** Their company spaces changed (a request, approved, added, deactivated): the client reads them again. */
export function emitSpacesChanged(userIds: readonly string[]): void {
  for (const userId of userIds) ioVivo?.to(userRoom(userId)).emit('workspaces.changed', {});
}

/** A space's people changed (22/10): its active members refresh the directory and «Miembros y roles». */
export function emitMembersChanged(userIds: readonly string[], workspaceId: string): void {
  for (const userId of userIds) ioVivo?.to(userRoom(userId)).emit('workspace.members.changed', { workspaceId });
}

/** A space's apps changed (manifest, commands, install): its members read the «/» list and the directory again. */
export function emitAppsChanged(userIds: readonly string[], workspaceId: string): void {
  for (const userId of userIds) ioVivo?.to(userRoom(userId)).emit('workspace.apps.changed', { workspaceId });
}

/** Se vinculó o se cerró una web: el teléfono relee su lista. */
export function avisarCambioDeVinculos(userId: string): void {
  ioVivo?.to(userRoom(userId)).emit('vinculos.changed', {});
}

/** My lists of chats changed (pending 45): my other devices read them again. */
export function emitChatListsChanged(userId: string): void {
  ioVivo?.to(userRoom(userId)).emit('chatLists.changed', {});
}

/** A presence that changed (pending 15): to the people I share a chat with. */
export function emitPresence(userIds: readonly string[], frame: object): void {
  for (const userId of userIds) ioVivo?.to(userRoom(userId)).emit('presence', frame);
}

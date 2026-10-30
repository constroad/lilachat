import { interesadosEnElHilo } from './hilos.js';
import { repartirPorToken } from './repartoDePush.js';
import { firmarRespuesta } from './tokenDeRespuesta.js';
import type { Message } from './chatModels.js';
import { ChatModel } from './chatModels.js';
import { DeviceModel, UserModel } from './models.js';
import { isOnline } from './presence.js';
import { buildPushSender, buildPushText, type PushSender } from './pushSender.js';
import { splitPushTargets } from './pushTargets.js';
import { sendWebPush } from './webPushSender.js';
import { CALL_TIMEOUT_MS, CAPACIDAD_LLAMADA_NATIVA, CAPACIDAD_MENSAJE_NATIVO, listThumbPath, mentionedUserIds, isQuietNow, notificationLevel, quietHoursOf, ringsFor, textoDelAvisoDeReaccion, winkTileUrl, type NotificationLevel } from '@lilachat/shared';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { firmarEntrega } from './entregaPorAviso.js';
import { firmarRechazo } from './llamadas.js';

/**
 * A quién notificar y con qué texto (F4).
 *
 * Separado de `pushSender` a propósito: acá vive la DECISIÓN —quién está fuera
 * de línea, qué dice el aviso— y allá el transporte. Así la decisión se prueba
 * sin red y el transporte se cambia sin tocarla.
 */
let sender: PushSender = buildPushSender();

/** Para los tests: se inyecta un emisor que solo anota. */
export function setPushSender(next: PushSender): void {
  sender = next;
}

/**
 * E3 (20/10): una respuesta de hilo le suena a quien escribió la raíz, a quien
 * ya respondió y a los mencionados. Con «También enviar al chat», a todos.
 */
async function soloInteresadosDelHilo(message: Message, candidatos: string[]): Promise<string[]> {
  if (!message.hiloDe || message.enElChat || candidatos.length === 0) return candidatos;
  const interesados = await interesadosEnElHilo(message.chatId, message.hiloDe);
  for (const userId of mentionedUserIds(message.menciones, candidatos, isOnline)) interesados.add(userId);
  return candidatos.filter((candidato) => interesados.has(candidato));
}

export async function notifyOffline(params: {
  message: Message;
  members: string[];
  senderId: string;
}): Promise<void> {
  // Al autor NUNCA (ni a sus otros dispositivos: ya recibieron `msg.new`).
  // Estar «conectado» ya no corta el push del TELÉFONO (José, 20/10: «no suena»):
  // la conexión es por persona —la web abierta o una app dormida con el socket
  // colgado contaban— y el teléfono quedaba mudo. Ver `comunes` abajo.
  const otros = params.members.filter((member) => member !== params.senderId);
  const candidatos = await soloInteresadosDelHilo(params.message, otros);
  if (candidatos.length === 0) return;

  // Quien SILENCIÓ este chat no recibe una notificación que suene: es el punto
  // de silenciarlo. Pero si su teléfono sabe acusar la entrega (FL8.2), igual
  // le va un push SILENCIOSO: silenciado no es «no le llegó».
  const [levels, dispositivos, sender_, chat] = await Promise.all([
    notificationLevelsOf(String(params.message.chatId), candidatos),
    DeviceModel.find({ userId: { $in: candidatos }, pushToken: { $exists: true, $ne: '' } })
      .select('pushToken platform userId capacidades')
      .lean(),
    UserModel.findById(params.senderId).select('name phone avatarUrl').lean(),
    ChatModel.findById(params.message.chatId).select('kind name encrypted avatarUrl workspaceId').lean(),
  ]);
  if (dispositivos.length === 0) return;
  // A mention rings even in a silenced chat, as in WhatsApp, unless the level
  // is «nothing» (E3b). The group mention for all reaches everyone; the one for here, whoever is online.
  const mentioned = mentionedUserIds(params.message.menciones, candidatos, isOnline);
  const silenciados = new Set([...levels].filter(([userId, level]) => !ringsFor(level, mentioned.has(userId))).map(([userId]) => userId));

  const autor = sender_?.name ?? sender_?.phone ?? 'Alguien';
  const nombreDelGrupo = chat?.kind === 'group' ? chat.name : undefined;
  const text = buildPushText({
    senderName: autor,
    // El nombre del chat solo aporta en un grupo: en un 1:1 sería el mismo
    // nombre dos veces.
    chatName: nombreDelGrupo,
    // E3: la respuesta de un hilo lo dice («En un hilo: …»).
    body: params.message.hiloDe && params.message.body ? `En un hilo: ${params.message.body}` : params.message.body,
    kind: params.message.kind,
  });

  // Un token, un envío (FL11): el teléfono con el aviso nativo no recibe además el común.
  const reparto = repartirPorToken(dispositivos, dibujaElMensaje);
  // El teléfono nativo lo recibe SIEMPRE: con la app adelante solo acusa la
  // entrega y no dibuja nada. El común (web, teléfono viejo) solo a quien no
  // tiene un socket vivo: si lo tiene, ya le llegó en vivo.
  const nativos = reparto.nativos;
  const comunes = reparto.comunes.filter((d) => !silenciados.has(String(d.userId)) && !isOnline(String(d.userId)));
  // Where tapping the notice lands (agentes 25/10/2026): the chat's space and, for a reply, its thread. Empty = none.
  const workspaceId = chat?.workspaceId ? String(chat.workspaceId) : '';
  const hiloDe = params.message.hiloDe !== undefined && params.message.hiloDe !== null ? String(params.message.hiloDe) : '';
  const data = { chatId: String(params.message.chatId), seq: params.message.seq, workspaceId, hiloDe };
  // DOS transportes para el mismo aviso: el teléfono por FCM y la pestaña del
  // navegador por Web Push. Son dispositivos distintos del mismo dueño, así que
  // los dos tienen que sonar (F6).
  const destinos = splitPushTargets(comunes);

  try {
    await Promise.all([
      destinos.fcm.length > 0 ? sender.send({ tokens: destinos.fcm, ...text, data }) : undefined,
      sendWebPush(destinos.web, { ...text, data }),
      ...mensajeSoloDatos({ message: params.message, nativos, silenciados, workspaceId, hiloDe, autor, telefono: sender_?.phone ?? '', chat: nombreDelGrupo ?? '', secreto: chat?.encrypted === true, text, photo: sender_?.avatarUrl, chatPhoto: chat?.kind === 'group' ? chat.avatarUrl : undefined }),
    ]);
  } catch (error) {
    // Un push que no sale no puede tumbar el envío: el mensaje YA está
    // guardado y el destinatario lo va a ver al sincronizar.
    console.error('[push] envío falló:', error instanceof Error ? error.message : error);
  }
}

type DispositivoDePush = { pushToken?: string; platform?: string; userId: unknown; capacidades?: string[] };

/** El teléfono que dibuja el aviso del mensaje y acusa la entrega (FL8.2). */
const dibujaElMensaje = (dispositivo: DispositivoDePush) =>
  dispositivo.platform !== 'web' && Boolean(dispositivo.capacidades?.includes(CAPACIDAD_MENSAJE_NATIVO));

/** The notice's thumbnail (pending 57): a sticker, photo or GIF's small image, or a wink's tile; never in a secret chat. */
export function pushImageOf(message: Pick<Message, 'kind' | 'deletedAt' | 'media' | 'wink'>, secret: boolean): string {
  if (secret) return '';
  const thumb = listThumbPath(message);
  return thumb ? toAbsoluteMediaUrl(thumb) : (winkTileUrl(message.wink) ?? '');
}

/** Lo que vive un push de mensaje en cola: lo mismo que su token de entrega. */
const VIDA_DEL_MENSAJE_S = 7 * 24 * 3600;

/**
 * El mensaje como push SOLO-DATOS (FL8.2), uno por persona: el token de
 * entrega es de esa persona y ese mensaje. Con lo justo para dibujarlo como
 * WhatsApp (quién, de qué grupo, qué dijo) sin abrir la app.
 */
function mensajeSoloDatos(params: {
  message: Message;
  nativos: DispositivoDePush[];
  silenciados: Set<string>;
  /** Where tapping the notice lands: the chat's space and the thread, as text; empty when none. */
  workspaceId: string;
  hiloDe: string;
  autor: string;
  /** El teléfono de quien escribe: el aviso nativo busca con él el nombre en la agenda (FL11). */
  telefono: string;
  chat: string;
  /** Chat secreto: sin «Responder» (la respuesta saldría sin cifrar). */
  secreto: boolean;
  text: { title: string; body: string };
  /** The author's and the group's photos, relative (pending 68): the notice shows them, like WhatsApp. */
  photo?: string;
  chatPhoto?: string;
}): Promise<void>[] {
  if (!sender.sendDatos || params.nativos.length === 0) return [];
  const chatId = String(params.message.chatId);
  const porPersona = new Map<string, string[]>();
  for (const dispositivo of params.nativos) {
    if (!dispositivo.pushToken) continue;
    const userId = String(dispositivo.userId);
    porPersona.set(userId, [...(porPersona.get(userId) ?? []), dispositivo.pushToken]);
  }
  return [...porPersona].map(([userId, tokens]) =>
    sender.sendDatos!({
      tokens,
      ttlSegundos: VIDA_DEL_MENSAJE_S,
      data: {
        tipo: 'mensaje',
        chatId,
        seq: String(params.message.seq),
        workspaceId: params.workspaceId,
        hiloDe: params.hiloDe,
        autor: params.autor,
        telefono: params.telefono,
        chat: params.chat,
        titulo: params.text.title,
        cuerpo: params.text.body,
        silencioso: params.silenciados.has(userId) ? '1' : '0',
        entrega: firmarEntrega({ chatId, userId, seq: params.message.seq }),
        // «Responder» y «Marcar como leído» desde el aviso (FL11).
        respuesta: params.secreto ? '' : firmarRespuesta({ chatId, userId }),
        imagen: pushImageOf(params.message, params.secreto),
        foto: params.photo ? toAbsoluteMediaUrl(params.photo) : '',
        fotoChat: params.chatPhoto ? toAbsoluteMediaUrl(params.chatPhoto) : '',
      },
    })
  );
}

/**
 * De un chat, cuáles de estos usuarios lo tienen SILENCIADO. Para no mandarles
 * push. Una sola lectura del chat: los flags viven en su subdoc de miembros.
 */
export async function notificationLevelsOf(chatId: string, userIds: string[], now: Date = new Date()): Promise<Map<string, NotificationLevel>> {
  const chat = await ChatModel.findById(chatId).select('members.userId members.muted members.avisos members.quietHours').lean();
  const levels = new Map<string, NotificationLevel>();
  for (const member of chat?.members ?? []) {
    if (!userIds.includes(String(member.userId))) continue;
    // Pending 17: inside my own quiet schedule nothing rings, not even a mention (calls still do).
    const quiet = member.quietHours ? quietHoursOf(member.quietHours) : null;
    levels.set(String(member.userId), quiet && isQuietNow(quiet, now) ? 'nada' : notificationLevel(member));
  }
  return levels;
}

/**
 * «Llamada de Ana» a los miembros DESCONECTADOS (FL8). Antes una llamada solo
 * le llegaba a quien tenía el socket abierto; con la app en segundo plano o
 * cerrada no sonaba nada. El toque abre la app, que al conectar recibe la
 * oferta que sigue sonando (`llamadas.ts`) y muestra la llamada.
 *
 * Silenciar un chat NO calla sus llamadas (como WhatsApp).
 */
export async function avisarLlamada(params: { chatId: string; from: string; members: string[]; video: boolean }): Promise<void> {
  // A TODOS menos a quien llama (José, 20/10: «la pantalla de Wilson estaba
  // apagada y no sonó; se enteró al desbloquear»): figuraba conectado y no le
  // iba push. El teléfono nativo suena siempre (con la app adelante no la
  // dibuja: la trae el socket); el común, solo si está desconectado.
  const otros = params.members.filter((member) => member !== params.from);
  if (otros.length === 0) return;
  const [dispositivos, quien] = await Promise.all([
    DeviceModel.find({ userId: { $in: otros }, pushToken: { $exists: true, $ne: '' } })
      .select('pushToken platform userId capacidades')
      .lean(),
    UserModel.findById(params.from).select('name phone').lean(),
  ]);
  if (dispositivos.length === 0) return;
  const nombre = quien?.name ?? quien?.phone ?? 'Alguien';
  // FL8.1: el que sabe dibujarla a pantalla completa la recibe solo-datos.
  // Un token, un envío (FL11): sin esto el mismo teléfono recibía la pantalla completa Y «Llamada de…».
  const { nativos, comunes } = repartirPorToken(
    dispositivos,
    (d) => d.platform !== 'web' && Boolean(d.capacidades?.includes(CAPACIDAD_LLAMADA_NATIVA))
  );
  const resto = comunes.filter((d) => !isOnline(String(d.userId)));
  const aviso = {
    title: `${params.video ? 'Videollamada' : 'Llamada'} de ${nombre}`,
    body: 'Toca para contestar',
    data: { chatId: params.chatId, seq: 0, tipo: 'llamada' as const },
  };
  const destinos = splitPushTargets(resto);
  try {
    await Promise.all([
      destinos.fcm.length > 0 ? sender.send({ tokens: destinos.fcm, ...aviso }) : undefined,
      sendWebPush(destinos.web, aviso),
      ...llamadaSoloDatos({ ...params, nombre, telefono: quien?.phone ?? '', nativos }),
    ]);
  } catch (error) {
    console.error('[push] no se pudo avisar la llamada:', error instanceof Error ? error.message : error);
  }
}

/**
 * Un push por persona: el token de rechazo es de ESA persona en ESE chat, así
 * que no se puede compartir entre los teléfonos de dos miembros.
 */
function llamadaSoloDatos(params: {
  chatId: string;
  from: string;
  video: boolean;
  nombre: string;
  telefono: string;
  nativos: { pushToken?: string; userId: unknown }[];
}): Promise<void>[] {
  if (!sender.sendDatos || params.nativos.length === 0) return [];
  const porPersona = new Map<string, string[]>();
  for (const dispositivo of params.nativos) {
    if (!dispositivo.pushToken) continue;
    const userId = String(dispositivo.userId);
    porPersona.set(userId, [...(porPersona.get(userId) ?? []), dispositivo.pushToken]);
  }
  return [...porPersona].map(([userId, tokens]) =>
    sender.sendDatos!({
      tokens,
      ttlSegundos: CALL_TIMEOUT_MS / 1000,
      data: {
        tipo: 'llamada',
        chatId: params.chatId,
        de: params.from,
        nombre: params.nombre,
        telefono: params.telefono,
        video: params.video ? '1' : '0',
        // Cuánto suena, relativo: el reloj del teléfono puede no ser el del server.
        queda: String(CALL_TIMEOUT_MS),
        rechazo: firmarRechazo({ chatId: params.chatId, userId }),
      },
    })
  );
}

/** Cuánto vive el «dejá de sonar»: si llega tarde, ya no hay nada que apagar. */
const VIDA_DEL_FIN_S = 60;

/**
 * La llamada terminó (o la contestaron en otro lado): que dejen de sonar los
 * teléfonos que la dibujaron a pantalla completa. A todos los miembros menos a
 * quien llamó, CONECTADOS O NO: el que contestó en un teléfono puede tener
 * otro sonando.
 */
export async function avisarFinDeLlamada(params: { chatId: string; from: string; members: string[] }): Promise<void> {
  if (!sender.sendDatos) return;
  const otros = params.members.filter((member) => member !== params.from);
  if (otros.length === 0) return;
  const nativos = await DeviceModel.find({
    userId: { $in: otros },
    platform: { $ne: 'web' },
    capacidades: CAPACIDAD_LLAMADA_NATIVA,
    pushToken: { $exists: true, $ne: '' },
  })
    .select('pushToken')
    .lean();
  // Un token, un envío (FL11): el mismo teléfono puede figurar en dos devices.
  const tokens = [...new Set(nativos.map((d) => d.pushToken).filter((t): t is string => Boolean(t)))];
  if (tokens.length === 0) return;
  try {
    await sender.sendDatos({ tokens, ttlSegundos: VIDA_DEL_FIN_S, data: { tipo: 'llamada-fin', chatId: params.chatId } });
  } catch (error) {
    console.error('[push] no se pudo apagar la llamada:', error instanceof Error ? error.message : error);
  }
}

/**
 * «Ana reaccionó 👍 a «…»» (20/10), como WhatsApp: solo al AUTOR del
 * mensaje, si no es quien reaccionó, si está fuera de línea y si no silenció
 * el chat. Quitar una reacción no avisa nada.
 */
export async function avisarReaccion(params: { chatId: string; seq: number; autor: string; quien: string; emoji: string; cuerpo?: string }): Promise<void> {
  if (params.autor === params.quien || isOnline(params.autor)) return;
  try {
    const [levels, dispositivos, quien, chat] = await Promise.all([
      notificationLevelsOf(params.chatId, [params.autor]),
      DeviceModel.find({ userId: params.autor, pushToken: { $exists: true, $ne: '' } }).select('pushToken platform userId').lean(),
      UserModel.findById(params.quien).select('name phone').lean(),
      ChatModel.findById(params.chatId).select('kind name workspaceId').lean(),
    ]);
    if ((levels.get(params.autor) ?? 'todo') !== 'todo' || dispositivos.length === 0) return;
    const nombre = quien?.name ?? quien?.phone ?? 'Alguien';
    const text = { title: chat?.kind === 'group' && chat.name ? `${chat.name} · ${nombre}` : nombre, body: textoDelAvisoDeReaccion(params.emoji, params.cuerpo) };
    const data = { chatId: params.chatId, seq: params.seq, workspaceId: chat?.workspaceId ? String(chat.workspaceId) : '' };
    const destinos = splitPushTargets(dispositivos);
    await Promise.all([destinos.fcm.length > 0 ? sender.send({ tokens: destinos.fcm, ...text, data }) : undefined, sendWebPush(destinos.web, { ...text, data })]);
  } catch (error) {
    console.error('[push] aviso de reacción falló:', error instanceof Error ? error.message : error);
  }
}

/**
 * Tasks ticked in a checklist (backlog 35): each notice to its recipient, if
 * they are offline and have not muted the chat, like a reaction. Tapping it
 * opens the chat on the checklist's card.
 */
export async function notifyTasksDone(params: { chatId: string; seq: number | undefined; title: string; notices: readonly { to: string; body: string }[] }): Promise<void> {
  const offline = params.notices.filter((notice) => !isOnline(notice.to));
  if (offline.length === 0) return;
  try {
    const recipients = offline.map((notice) => notice.to);
    const [levels, devices, chat] = await Promise.all([
      notificationLevelsOf(params.chatId, recipients),
      DeviceModel.find({ userId: { $in: recipients }, pushToken: { $exists: true, $ne: '' } }).select('pushToken platform userId').lean(),
      ChatModel.findById(params.chatId).select('workspaceId').lean(),
    ]);
    // seq 0 opens the chat at its end (a checklist from before it kept its card).
    const data = { chatId: params.chatId, seq: params.seq ?? 0, workspaceId: chat?.workspaceId ? String(chat.workspaceId) : '' };
    await Promise.all(
      offline
        .filter((notice) => (levels.get(notice.to) ?? 'todo') === 'todo')
        .map(async (notice) => {
          const targets = splitPushTargets(devices.filter((device) => String(device.userId) === notice.to));
          const text = { title: params.title, body: notice.body };
          await Promise.all([targets.fcm.length > 0 ? sender.send({ tokens: targets.fcm, ...text, data }) : undefined, sendWebPush(targets.web, { ...text, data })]);
        })
    );
  } catch (error) {
    console.error('[push] aviso de tareas falló:', error instanceof Error ? error.message : error);
  }
}

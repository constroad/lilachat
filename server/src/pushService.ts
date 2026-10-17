import type { Message } from './chatModels.js';
import { ChatModel } from './chatModels.js';
import { DeviceModel, UserModel } from './models.js';
import { isOnline } from './presence.js';
import { buildPushSender, buildPushText, type PushSender } from './pushSender.js';
import { splitPushTargets } from './pushTargets.js';
import { sendWebPush } from './webPushSender.js';
import { CALL_TIMEOUT_MS, CAPACIDAD_LLAMADA_NATIVA, CAPACIDAD_MENSAJE_NATIVO } from '@lilachat/shared';
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

export async function notifyOffline(params: {
  message: Message;
  members: string[];
  senderId: string;
}): Promise<void> {
  // Al autor NUNCA (ni a sus otros dispositivos: ya recibieron `msg.new`), y a
  // quien tiene un socket vivo tampoco — está mirando la conversación.
  const candidatos = params.members.filter(
    (member) => member !== params.senderId && !isOnline(member)
  );
  if (candidatos.length === 0) return;

  // Quien SILENCIÓ este chat no recibe una notificación que suene: es el punto
  // de silenciarlo. Pero si su teléfono sabe acusar la entrega (FL8.2), igual
  // le va un push SILENCIOSO: silenciado no es «no le llegó».
  const [silenciados, dispositivos, sender_, chat] = await Promise.all([
    chatsSilenciadosDeChat(String(params.message.chatId), candidatos),
    DeviceModel.find({ userId: { $in: candidatos }, pushToken: { $exists: true, $ne: '' } })
      .select('pushToken platform userId capacidades')
      .lean(),
    UserModel.findById(params.senderId).select('name phone').lean(),
    ChatModel.findById(params.message.chatId).select('kind name').lean(),
  ]);
  if (dispositivos.length === 0) return;

  const autor = sender_?.name ?? sender_?.phone ?? 'Alguien';
  const nombreDelGrupo = chat?.kind === 'group' ? chat.name : undefined;
  const text = buildPushText({
    senderName: autor,
    // El nombre del chat solo aporta en un grupo: en un 1:1 sería el mismo
    // nombre dos veces.
    chatName: nombreDelGrupo,
    body: params.message.body,
    kind: params.message.kind,
  });

  const nativos = dispositivos.filter(dibujaElMensaje);
  const comunes = dispositivos.filter((d) => !dibujaElMensaje(d) && !silenciados.has(String(d.userId)));
  const data = { chatId: String(params.message.chatId), seq: params.message.seq };
  // DOS transportes para el mismo aviso: el teléfono por FCM y la pestaña del
  // navegador por Web Push. Son dispositivos distintos del mismo dueño, así que
  // los dos tienen que sonar (F6).
  const destinos = splitPushTargets(comunes);

  try {
    await Promise.all([
      destinos.fcm.length > 0 ? sender.send({ tokens: destinos.fcm, ...text, data }) : undefined,
      sendWebPush(destinos.web, { ...text, data }),
      ...mensajeSoloDatos({ message: params.message, nativos, silenciados, autor, chat: nombreDelGrupo ?? '', text }),
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
  autor: string;
  chat: string;
  text: { title: string; body: string };
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
        autor: params.autor,
        chat: params.chat,
        titulo: params.text.title,
        cuerpo: params.text.body,
        silencioso: params.silenciados.has(userId) ? '1' : '0',
        entrega: firmarEntrega({ chatId, userId, seq: params.message.seq }),
      },
    })
  );
}

/**
 * De un chat, cuáles de estos usuarios lo tienen SILENCIADO. Para no mandarles
 * push. Una sola lectura del chat: los flags viven en su subdoc de miembros.
 */
async function chatsSilenciadosDeChat(chatId: string, userIds: string[]): Promise<Set<string>> {
  const chat = await ChatModel.findById(chatId).select('members.userId members.muted').lean();
  if (!chat) return new Set();
  const set = new Set<string>();
  for (const member of chat.members) {
    if (member.muted === true && userIds.includes(String(member.userId))) {
      set.add(String(member.userId));
    }
  }
  return set;
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
  const desconectados = params.members.filter((member) => member !== params.from && !isOnline(member));
  if (desconectados.length === 0) return;
  const [dispositivos, quien] = await Promise.all([
    DeviceModel.find({ userId: { $in: desconectados }, pushToken: { $exists: true, $ne: '' } })
      .select('pushToken platform userId capacidades')
      .lean(),
    UserModel.findById(params.from).select('name phone').lean(),
  ]);
  if (dispositivos.length === 0) return;
  const nombre = quien?.name ?? quien?.phone ?? 'Alguien';
  // FL8.1: el que sabe dibujarla a pantalla completa la recibe solo-datos.
  const nativos = dispositivos.filter((d) => d.platform !== 'web' && d.capacidades?.includes(CAPACIDAD_LLAMADA_NATIVA));
  const resto = dispositivos.filter((d) => !nativos.includes(d));
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
  const tokens = nativos.map((d) => d.pushToken).filter((t): t is string => Boolean(t));
  if (tokens.length === 0) return;
  try {
    await sender.sendDatos({ tokens, ttlSegundos: VIDA_DEL_FIN_S, data: { tipo: 'llamada-fin', chatId: params.chatId } });
  } catch (error) {
    console.error('[push] no se pudo apagar la llamada:', error instanceof Error ? error.message : error);
  }
}

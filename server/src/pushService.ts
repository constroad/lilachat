import type { Message } from './chatModels.js';
import { ChatModel } from './chatModels.js';
import { DeviceModel, UserModel } from './models.js';
import { isOnline } from './presence.js';
import { buildPushSender, buildPushText, type PushSender } from './pushSender.js';
import { splitPushTargets } from './pushTargets.js';
import { sendWebPush } from './webPushSender.js';

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

  // Quien SILENCIÓ este chat no recibe push: es el punto de silenciarlo.
  const silenciados = await chatsSilenciadosDeChat(String(params.message.chatId), candidatos);
  const targets = candidatos.filter((member) => !silenciados.has(member));
  if (targets.length === 0) return;

  const [tokens, sender_, chat] = await Promise.all([
    DeviceModel.find({ userId: { $in: targets }, pushToken: { $exists: true, $ne: '' } })
      .select('pushToken platform')
      .lean(),
    UserModel.findById(params.senderId).select('name phone').lean(),
    ChatModel.findById(params.message.chatId).select('kind name').lean(),
  ]);
  if (tokens.length === 0) return;

  const text = buildPushText({
    senderName: sender_?.name ?? sender_?.phone ?? 'Alguien',
    // El nombre del chat solo aporta en un grupo: en un 1:1 sería el mismo
    // nombre dos veces.
    chatName: chat?.kind === 'group' ? chat.name : undefined,
    body: params.message.body,
    kind: params.message.kind,
  });

  const data = { chatId: String(params.message.chatId), seq: params.message.seq };
  // DOS transportes para el mismo aviso: el teléfono por FCM y la pestaña del
  // navegador por Web Push. Son dispositivos distintos del mismo dueño, así que
  // los dos tienen que sonar (F6).
  const destinos = splitPushTargets(tokens);

  try {
    await Promise.all([
      destinos.fcm.length > 0 ? sender.send({ tokens: destinos.fcm, ...text, data }) : undefined,
      sendWebPush(destinos.web, { ...text, data }),
    ]);
  } catch (error) {
    // Un push que no sale no puede tumbar el envío: el mensaje YA está
    // guardado y el destinatario lo va a ver al sincronizar.
    console.error('[push] envío falló:', error instanceof Error ? error.message : error);
  }
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

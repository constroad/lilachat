import type { Message } from './chatModels.js';
import { ChatModel } from './chatModels.js';
import { DeviceModel, UserModel } from './models.js';
import { isOnline } from './presence.js';
import { buildPushSender, buildPushText, type PushSender } from './pushSender.js';

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
  const targets = params.members.filter(
    (member) => member !== params.senderId && !isOnline(member)
  );
  if (targets.length === 0) return;

  const [tokens, sender_, chat] = await Promise.all([
    DeviceModel.find({ userId: { $in: targets }, pushToken: { $exists: true, $ne: '' } })
      .select('pushToken')
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

  try {
    await sender.send({
      tokens: tokens.map((device) => device.pushToken!).filter(Boolean),
      ...text,
      data: { chatId: String(params.message.chatId), seq: params.message.seq },
    });
  } catch (error) {
    // Un push que no sale no puede tumbar el envío: el mensaje YA está
    // guardado y el destinatario lo va a ver al sincronizar.
    console.error('[push] envío falló:', error instanceof Error ? error.message : error);
  }
}

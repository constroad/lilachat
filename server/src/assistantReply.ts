import { Types } from 'mongoose';
import { detectLilaMention } from '@lilachat/shared';
import { answerMention } from './assistantService.js';
import { ChatModel } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { UserModel } from './models.js';

/**
 * `@lila` dentro de la conversación (F8).
 *
 * La respuesta se guarda como UN MENSAJE MÁS del chat, con su `seq` y su
 * `clientKey`, y no como un objeto aparte. Así se sincroniza, se busca, se
 * respalda y se exporta con todo lo demás — un canal paralelo para el asistente
 * habría necesitado su propia versión de cada una de esas cuatro cosas.
 *
 * **No bloquea el envío.** El mensaje de quien escribió ya está guardado y
 * repartido antes de que Lila empiece a pensar; si el modelo tarda o falla, la
 * conversación siguió igual.
 */

/** El usuario con el que firma Lila. Se crea una vez y se reusa. */
const LILA_PHONE = '000000000';
let lilaId: Types.ObjectId | null = null;

export async function assistantUserId(): Promise<Types.ObjectId> {
  if (lilaId) return lilaId;
  const user = await UserModel.findOneAndUpdate(
    { phone: LILA_PHONE },
    { $setOnInsert: { phone: LILA_PHONE, name: 'Lila' } },
    { upsert: true, returnDocument: 'after' }
  );
  lilaId = user._id;
  return lilaId;
}

/** Para los tests: el id cacheado no puede sobrevivir a una base nueva. */
export function resetAssistantUser(): void {
  lilaId = null;
}

export async function maybeAnswerMention(params: {
  chatId: Types.ObjectId;
  askedBy: Types.ObjectId;
  body?: string;
  /** Se llama con el mensaje de Lila ya guardado, para repartirlo por socket. */
  onReply: (message: Awaited<ReturnType<typeof sendMessage>>['message']) => Promise<void>;
}): Promise<void> {
  const mention = detectLilaMention(params.body ?? '');
  if (!mention) return;

  try {
    const answer = await answerMention({
      chatId: params.chatId,
      userId: params.askedBy,
      request: mention.request,
    });

    // Cuando falla, Lila lo DICE en el chat en vez de quedarse muda: un
    // asistente que no contesta se lee como una app rota.
    const text = answer.ok ? answer.text : `No pude responder ahora. (${answer.message})`;

    // LILA SE SUMA AL CHAT la primera vez que la llaman ahí.
    //
    // `sendMessage` exige membresía —y está bien que la exija: es el permiso de
    // todo el sistema—. La alternativa era una excepción para el asistente, y
    // una excepción en el control de acceso es justo donde después se cuela
    // todo. Además así Lila APARECE en la lista de miembros: la familia ve que
    // está, en vez de descubrir que alguien lee el chat.
    const lila = await assistantUserId();
    await ChatModel.updateOne(
      { _id: params.chatId, 'members.userId': { $ne: lila } },
      { $push: { members: { userId: lila } } }
    );

    const result = await sendMessage({
      chatId: String(params.chatId),
      senderId: lila,
      // La clave sale del chat y del mensaje que la invocó: si el envío se
      // reintenta, no se duplica la respuesta.
      clientKey: `lila-${params.chatId}-${Date.now()}`,
      kind: 'text',
      body: text,
    });
    await params.onReply(result.message);
  } catch (error) {
    console.error('[lila] no pudo responder:', error instanceof Error ? error.message : error);
  }
}

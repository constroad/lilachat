import { Types } from 'mongoose';
import {
  CONTEXT_LIMITS,
  parseEventDraft,
  selectContextMessages,
  type ContextMessage,
  type EventDraft,
} from '@lilachat/shared';
import { ChatModel, MessageModel } from './chatModels.js';
import { UserModel } from './models.js';
import { buildAssistantClient, type AssistantClient, type AskOutcome } from './assistantClient.js';

/**
 * Qué le pedimos a Lila y con qué contexto (F8).
 *
 * Separado del cliente igual que en push: acá vive la DECISIÓN —qué mensajes
 * viajan, qué se le pide, qué se hace con la respuesta— y allá el transporte.
 *
 * **La membresía del chat es el permiso**, como en todo el resto. Sin eso,
 * «resumime el chat X» sería una forma de leer conversaciones ajenas con la
 * ayuda del asistente.
 */
let client: AssistantClient = buildAssistantClient();

/** Para los tests: se inyecta un cliente que no habla con nadie. */
export function setAssistantClient(next: AssistantClient): void {
  client = next;
}

export class NotAMemberError extends Error {
  constructor() {
    super('No tienes acceso a esa conversación.');
  }
}

/**
 * Un chat cifrado NO pasa por el asistente.
 *
 * Es la trampa más peligrosa de F9: mandarle a Claude el contenido de un chat
 * con candado sería el peor de los dos mundos —la promesa del cifrado y el
 * texto saliendo por la puerta de al lado—. Acá el server ni siquiera TIENE el
 * texto, así que el corte es real y no una cortesía.
 */
export class EncryptedChatError extends Error {
  constructor() {
    super('Este chat está cifrado: Lila no puede leerlo.');
  }
}

const PERSONA =
  'Eres Lila, la asistente de un chat familiar peruano. Respondes en español, ' +
  'en tono cercano y breve —dos o tres frases salvo que te pidan más—. ' +
  'Hablas de la conversación que te muestran y NUNCA inventas datos que no ' +
  'estén ahí: si no aparece, dices que no lo ves en el chat.';

async function contextOf(
  chatId: Types.ObjectId,
  userId: Types.ObjectId,
  options: { sinceSeq?: number } = {}
): Promise<{ chatName: string; messages: ContextMessage[] }> {
  const chat = await ChatModel.findOne({ _id: chatId, 'members.userId': userId }).lean();
  if (!chat) throw new NotAMemberError();
  if (chat.encrypted) throw new EncryptedChatError();

  const query: Record<string, unknown> = { chatId };
  if (options.sinceSeq !== undefined) query.seq = { $gt: options.sinceSeq };

  const [rows, users] = await Promise.all([
    MessageModel.find(query).sort({ seq: 1 }).limit(200).select('seq body kind senderId').lean(),
    UserModel.find({ _id: { $in: chat.members.map((member) => member.userId) } })
      .select('name phone')
      .lean(),
  ]);

  const nombre = new Map(users.map((user) => [String(user._id), user.name ?? user.phone]));

  return {
    chatName: chat.name ?? 'la conversación',
    messages: selectContextMessages(
      rows.map((row) => ({
        seq: row.seq,
        body: row.body ?? '',
        kind: row.kind,
        from: nombre.get(String(row.senderId)) ?? 'Alguien',
      })),
      CONTEXT_LIMITS
    ),
  };
}

const transcript = (messages: ContextMessage[]): string =>
  messages.map((message) => `${message.from}: ${message.body}`).join('\n');

/**
 * «Ponme al día»: el resumen de lo que no leí.
 *
 * Va desde MI cursor de lectura, no desde el principio: resumirle a alguien lo
 * que ya leyó es ruido, y en un chat familiar de años sería carísimo.
 */
export async function catchUp(params: {
  chatId: Types.ObjectId;
  userId: Types.ObjectId;
  sinceSeq: number;
}): Promise<AskOutcome & { messageCount?: number }> {
  const { chatName, messages } = await contextOf(params.chatId, params.userId, {
    sinceSeq: params.sinceSeq,
  });

  // Sin nada nuevo NO se llama al modelo: se paga por no decir nada.
  if (messages.length === 0) {
    return { ok: true, text: 'No te perdiste nada: no hay mensajes nuevos.', messageCount: 0 };
  }

  const outcome = await client.ask({
    system: PERSONA,
    prompt:
      `Estos son los mensajes que ${'no leí'} en «${chatName}». ` +
      'Resúmelos en pocas frases: qué se decidió, qué queda pendiente y si alguien ' +
      'me preguntó algo directamente.\n\n' +
      transcript(messages),
  });

  return { ...outcome, messageCount: messages.length };
}

/** La respuesta a un `@lila` dentro de la conversación. */
export async function answerMention(params: {
  chatId: Types.ObjectId;
  userId: Types.ObjectId;
  request: string;
}): Promise<AskOutcome> {
  const { chatName, messages } = await contextOf(params.chatId, params.userId);

  const pedido = params.request.trim() || '¿En qué me puedes ayudar?';
  return client.ask({
    system: PERSONA,
    prompt:
      `Estás en «${chatName}». Esto es lo último que se habló:\n\n${transcript(messages)}\n\n` +
      `Te preguntan: ${pedido}`,
  });
}

/**
 * Lenguaje natural → borrador de evento.
 *
 * **Borrador, no evento.** Devuelve algo para que la persona confirme; crear el
 * evento directo dejaría que una frase mal entendida le mande una invitación a
 * toda la familia.
 */
export async function draftEvent(params: {
  chatId: Types.ObjectId;
  userId: Types.ObjectId;
  text: string;
  now?: Date;
}): Promise<{ ok: true; draft: EventDraft } | { ok: false; message: string }> {
  await contextOf(params.chatId, params.userId);

  const ahora = (params.now ?? new Date()).toISOString();
  const outcome = await client.ask({
    system:
      'Conviertes una frase en un evento de calendario. Respondes SOLO con un JSON ' +
      '{"title","startsAt","location"}. `startsAt` en ISO 8601 con zona. ' +
      'Si la frase no alcanza para armar un evento, respondes {}.',
    prompt: `Ahora es ${ahora} (zona de Lima, UTC-5). Frase: ${params.text}`,
    maxTokens: 300,
  });

  if (!outcome.ok) return { ok: false, message: outcome.message };

  const draft = parseEventDraft(outcome.text);
  return draft
    ? { ok: true, draft }
    : { ok: false, message: 'No entendí la fecha. Prueba con algo como «cena el sábado a las 8».' };
}

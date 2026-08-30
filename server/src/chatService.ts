import { Types } from 'mongoose';
import {
  unreadCount,
  puedeEliminar,
  puedeAgregar,
  puedeSacar,
  puedeCambiarRol,
  decidirSalida,
} from '@lilachat/shared';
import { UserModel } from './models.js';
import { ChatModel, MessageModel, ReceiptModel, type Chat, type Message } from './chatModels.js';

/**
 * La lógica de mensajería (spec §6). Todo pasa por acá: las rutas REST y el
 * socket son dos puertas al MISMO servicio, para que las reglas —membresía,
 * `seq`, idempotencia— no existan por duplicado con dos comportamientos.
 */

/** Chat ajeno o inexistente: el mismo error para los dos, a propósito. */
export class ForbiddenChatError extends Error {
  constructor() {
    super('No tienes acceso a esa conversación.');
    this.name = 'ForbiddenChatError';
  }
}

const toObjectId = (value: string | Types.ObjectId): Types.ObjectId | null => {
  if (value instanceof Types.ObjectId) return value;
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
};

/**
 * ¿Este usuario es miembro? Se resuelve en la CONSULTA (`members.userId`), no
 * cargando el chat y filtrando después: así un id ajeno nunca llega a leer un
 * documento que no le corresponde.
 */
async function assertMember(chatId: string, userId: Types.ObjectId): Promise<Types.ObjectId> {
  const id = toObjectId(chatId);
  if (!id) throw new ForbiddenChatError();
  const chat = await ChatModel.exists({ _id: id, 'members.userId': userId });
  if (!chat) throw new ForbiddenChatError();
  return id;
}

export type SendResult = { message: Message; duplicate: boolean };

/**
 * Envía un mensaje. Idempotente por `clientKey`.
 *
 * El orden importa: primero se busca el duplicado (barato) y recién después se
 * consume un `seq`. Al revés, cada reintento quemaría un número y dejaría
 * huecos en la numeración del chat.
 */
export async function sendMessage(params: {
  chatId: string;
  senderId: Types.ObjectId;
  clientKey: string;
  kind?: Message['kind'];
  body?: string;
  /** El sobre cifrado, en los chats secretos (F9). Excluyente con `body`. */
  envelope?: Message['envelope'];
  media?: Message['media'];
  replyToSeq?: number;
}): Promise<SendResult> {
  const chatId = await assertMember(params.chatId, params.senderId);

  const existing = await MessageModel.findOne({
    chatId,
    senderId: params.senderId,
    clientKey: params.clientKey,
  }).lean<Message | null>();
  if (existing) return { message: existing, duplicate: true };

  // `$inc` atómico: es lo que garantiza que dos envíos simultáneos no tomen el
  // mismo número. El índice único {chatId, seq} es el cinturón por si acaso.
  const chat = await ChatModel.findOneAndUpdate(
    { _id: chatId },
    { $inc: { lastSeq: 1 } },
    { returnDocument: 'after' }
  ).lean<{ lastSeq: number } | null>();
  if (!chat) throw new ForbiddenChatError();

  try {
    const created = await MessageModel.create({
      chatId,
      seq: chat.lastSeq,
      senderId: params.senderId,
      clientKey: params.clientKey,
      kind: params.kind ?? 'text',
      // EN UN CHAT CIFRADO NO SE GUARDA `body`, aunque el cliente lo mande.
      // Es el corte que hace real la promesa: si el server aceptara los dos
      // campos, un cliente con un bug —o modificado— dejaría el texto en claro
      // dentro de una conversación con candado, y nadie lo notaría.
      ...(params.envelope
        ? { envelope: params.envelope }
        : { body: params.body }),
      media: params.media,
      replyToSeq: params.replyToSeq,
      at: new Date(),
    });
    return { message: created.toObject() as Message, duplicate: false };
  } catch (error) {
    // Carrera: dos reintentos del MISMO mensaje entraron a la vez y el índice
    // único de `clientKey` frenó al segundo. Eso no es un fallo — el hecho está
    // guardado, y quien llama tiene que verlo como duplicado, no como error.
    const duplicated = (error as { code?: number }).code === 11000;
    if (!duplicated) throw error;
    const saved = await MessageModel.findOne({
      chatId,
      senderId: params.senderId,
      clientKey: params.clientKey,
    }).lean<Message | null>();
    if (!saved) throw error;
    return { message: saved, duplicate: true };
  }
}

export async function listMessages(params: {
  chatId: string;
  userId: Types.ObjectId;
  limit?: number;
  beforeSeq?: number;
}): Promise<Message[]> {
  const chatId = await assertMember(params.chatId, params.userId);
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);

  // Se pide DESCENDENTE (la página más reciente) y se devuelve ascendente: es
  // el orden en que se lee una conversación.
  const page = await MessageModel.find({
    chatId,
    ...(params.beforeSeq ? { seq: { $lt: params.beforeSeq } } : {}),
  })
    .sort({ seq: -1 })
    .limit(limit)
    .lean<Message[]>();
  return page.reverse();
}

/** Tope de mensajes por chat en una sincronización: un cliente que vuelve tras
 *  semanas no puede arrastrar la respuesta a decenas de MB. Lo que falte se
 *  pide con la siguiente pasada, porque el cursor avanzó. */
const SYNC_LIMIT_PER_CHAT = 200;

export async function pullSince(params: {
  userId: Types.ObjectId;
  cursors: Record<string, number>;
}): Promise<{ chatId: string; messages: Message[] }[]> {
  // Los chats salen de la MEMBRESÍA, nunca de las claves que mandó el cliente:
  // si se iterara sobre los cursores, un chatId ajeno filtraría mensajes.
  const chats = await ChatModel.find({ 'members.userId': params.userId })
    .select('_id')
    .lean<{ _id: Types.ObjectId }[]>();

  const batches = await Promise.all(
    chats.map(async (chat) => {
      const chatId = String(chat._id);
      const since = Number(params.cursors[chatId] ?? 0);
      const messages = await MessageModel.find({
        chatId: chat._id,
        seq: { $gt: Number.isFinite(since) ? since : 0 },
      })
        .sort({ seq: 1 })
        .limit(SYNC_LIMIT_PER_CHAT)
        .lean<Message[]>();
      return { chatId, messages };
    })
  );
  return batches.filter((batch) => batch.messages.length > 0);
}

export type ChatSummary = {
  id: string;
  kind: 'direct' | 'group';
  name?: string;
  /**
   * El teléfono de la OTRA persona, solo en chats 1:1.
   *
   * Existe para que la app pueda mostrar el nombre que vos le pusiste en tu
   * agenda (27/08/2026: José leía «960397018» en vez de «Wilson»). El server no
   * puede resolverlo —solo conoce el nombre que esa persona se puso, y la agenda
   * del teléfono nunca sube acá—, así que le manda la clave para cruzar.
   *
   * **No filtra nada nuevo:** con quien ya compartís un chat directo, su teléfono
   * ya se veía — de hecho es exactamente lo que aparecía como nombre cuando no
   * tenía uno.
   */
  phone?: string;
  memberIds: string[];
  lastSeq: number;
  unread: number;
  lastMessage: { seq: number; body?: string; kind?: string; senderId: string; at: Date } | null;
  /** Hasta qué `seq` leyeron los DEMÁS: de acá salen los checks del diseño. */
  othersReadSeq: number;
  othersDeliveredSeq: number;
  /** Chat secreto (F9): la lista lo marca con candado y no muestra el último. */
  encrypted?: boolean;
};

export async function listChats(userId: Types.ObjectId): Promise<ChatSummary[]> {
  const chats = await ChatModel.find({ 'members.userId': userId }).lean();
  if (chats.length === 0) return [];

  const chatIds = chats.map((chat) => chat._id);
  // Paralelo: son dos consultas independientes y la lista de chats es la
  // primera pantalla de la app (constroad-performance).
  // Los nombres de todos los miembros: un chat 1:1 no tiene `name` propio y se
  // muestra con el nombre del OTRO. Sin esto la lista decía «Conversación» para
  // cada persona, que es indistinguible de otra.
  const otrosIds = [
    ...new Set(
      chats.flatMap((chat) =>
        chat.members.map((member) => String(member.userId)).filter((id) => id !== String(userId))
      )
    ),
  ];

  const [allReceipts, lastMessages] = await Promise.all([
    ReceiptModel.find({ chatId: { $in: chatIds } }).lean(),
    Promise.all(
      chats.map((chat) =>
        MessageModel.findOne({ chatId: chat._id }).sort({ seq: -1 }).lean<Message | null>()
      )
    ),
  ]);
  const otros = await UserModel.find({ _id: { $in: otrosIds } }).select('name phone').lean();
  const personas = new Map(otros.map((user) => [String(user._id), user.name ?? user.phone]));
  const telefonos = new Map(otros.map((user) => [String(user._id), user.phone]));

  const receipts = allReceipts.filter((receipt) => String(receipt.userId) === String(userId));
  const readByChat = new Map(receipts.map((receipt) => [String(receipt.chatId), receipt.readSeq]));
  // Los acuses AJENOS, que son los que deciden el check de mis mensajes. En un
  // grupo manda el MENOR: «leído» solo cuando lo leyeron todos, igual que el
  // doble check azul de cualquier mensajería.
  const othersByChat = new Map<string, { read: number; delivered: number }>();
  for (const receipt of allReceipts) {
    if (String(receipt.userId) === String(userId)) continue;
    const key = String(receipt.chatId);
    const current = othersByChat.get(key);
    othersByChat.set(key, {
      read: current ? Math.min(current.read, receipt.readSeq) : receipt.readSeq,
      delivered: current ? Math.min(current.delivered, receipt.deliveredSeq) : receipt.deliveredSeq,
    });
  }

  return chats.map((chat, index) => {
    const last = lastMessages[index];
    const otroId =
      chat.kind === 'direct'
        ? (chat.members.map((member) => String(member.userId)).find((id) => id !== String(userId)) ??
          '')
        : '';
    return {
      id: String(chat._id),
      kind: chat.kind,
      // En un 1:1, el nombre ES el del otro.
      name: chat.name ?? (chat.kind === 'direct' ? personas.get(otroId) : undefined),
      // Solo en 1:1: en un grupo no hay «el otro», y mandar la lista de
      // teléfonos de todos los miembros sí sería filtrar algo nuevo.
      phone: chat.kind === 'direct' ? telefonos.get(otroId) : undefined,
      encrypted: chat.encrypted === true,
      memberIds: chat.members.map((member) => String(member.userId)),
      lastSeq: chat.lastSeq,
      unread: unreadCount({
        lastSeq: chat.lastSeq,
        readSeq: readByChat.get(String(chat._id)) ?? 0,
      }),
      lastMessage: last
        ? {
            seq: last.seq,
            body: last.body,
            kind: last.kind,
            senderId: String(last.senderId),
            at: last.at,
          }
        : null,
      othersReadSeq: othersByChat.get(String(chat._id))?.read ?? 0,
      othersDeliveredSeq: othersByChat.get(String(chat._id))?.delivered ?? 0,
    };
  });
}

/**
 * Marca leído hasta `seq`. **Nunca retrocede** (`$max`): dos dispositivos del
 * mismo usuario mandan acuses desordenados, y el que llega tarde no puede
 * resucitar mensajes ya leídos.
 */
export async function markRead(params: {
  chatId: string;
  userId: Types.ObjectId;
  seq: number;
}): Promise<void> {
  const chatId = await assertMember(params.chatId, params.userId);
  await ReceiptModel.updateOne(
    { chatId, userId: params.userId },
    { $max: { readSeq: params.seq, deliveredSeq: params.seq } },
    { upsert: true }
  );
}

/** Los demás miembros de un chat: a quién notificar. */
export async function chatMemberIds(chatId: Types.ObjectId): Promise<string[]> {
  const chat = await ChatModel.findById(chatId).select('members.userId').lean();
  return (chat?.members ?? []).map((member) => String(member.userId));
}

/**
 * Borrar un mensaje PARA TODOS.
 *
 * José lo pidió tres veces (27/08/2026). Dos decisiones que valen:
 *
 * - **El contenido se va de verdad**, no queda tras una bandera. El server
 *   guarda las conversaciones en claro (§32 del as-is), así que un «eliminado»
 *   que conserva el texto no protege de nada — cualquiera con acceso a la base
 *   lo sigue leyendo.
 * - **Queda una lápida.** Si el mensaje desapareciera sin rastro, la
 *   conversación del otro lado cambiaría de sentido —respuestas colgando de algo
 *   que ya no está— sin que se entere.
 *
 * El permiso se decide en `shared/eliminarMensaje.ts` y se comprueba ACÁ además
 * de en la app: un cliente modificado se saltea cualquier validación del
 * teléfono, así que la app solo evita el viaje, no protege.
 */
export async function deleteMessage(params: {
  chatId: string;
  seq: number;
  userId: Types.ObjectId;
}): Promise<{ ok: true; message: Message } | { ok: false; motivo: string }> {
  // La membresía primero: sin esto se podría sondear si un `seq` existe en un
  // chat ajeno por la diferencia entre «no permitido» y «no existe».
  const chat = await ChatModel.findOne({
    _id: params.chatId,
    'members.userId': params.userId,
  }).lean();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

  const mensaje = await MessageModel.findOne({
    chatId: params.chatId,
    seq: params.seq,
  }).lean<Message | null>();
  if (!mensaje) return { ok: false, motivo: 'No encontramos ese mensaje.' };

  const decision = puedeEliminar({
    yo: String(params.userId),
    autor: String(mensaje.senderId),
    yaEliminado: Boolean(mensaje.deletedAt),
  });
  if (!decision.permitido) return { ok: false, motivo: decision.motivo };

  const actualizado = await MessageModel.findOneAndUpdate(
    { chatId: params.chatId, seq: params.seq },
    // `$unset` y no «poner en vacío»: el campo se va del documento.
    { $set: { deletedAt: new Date() }, $unset: { body: '', envelope: '', media: '' } },
    { returnDocument: 'after' }
  ).lean<Message | null>();

  return actualizado
    ? { ok: true, message: actualizado }
    : { ok: false, motivo: 'No se pudo eliminar.' };
}

/**
 * Sumar a alguien a un grupo.
 *
 * El permiso se decide en `shared/miembrosDeGrupo.ts` y se comprueba ACÁ: la app
 * solo evita el viaje, no protege — un cliente modificado se saltea cualquier
 * validación del teléfono.
 */
export async function addMember(params: {
  chatId: string;
  quien: Types.ObjectId;
  aQuien: string;
}): Promise<{ ok: true; chat: Chat } | { ok: false; motivo: string }> {
  const chat = await ChatModel.findOne({ _id: params.chatId }).lean<Chat | null>();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

  const decision = puedeAgregar({
    quien: String(params.quien),
    aQuien: params.aQuien,
    esGrupo: chat.kind === 'group',
    miembros: chat.members.map((m) => ({
      userId: String(m.userId),
      role: (m.role ?? 'member') as 'admin' | 'member',
    })),
  });
  if (!decision.ok) return { ok: false, motivo: decision.motivo };

  // Que la persona EXISTA se comprueba acá y no en el motor: es un dato de la
  // base, no una regla. Sumar un id inventado dejaría un miembro fantasma que
  // aparece en la lista y no es nadie.
  const persona = await UserModel.findById(params.aQuien).select('_id').lean();
  if (!persona) return { ok: false, motivo: 'No encontramos a esa persona.' };

  const actualizado = await ChatModel.findOneAndUpdate(
    // `$ne` en la condición y no solo `$addToSet`: así dos toques simultáneos no
    // pueden dejar a la misma persona dos veces en la lista.
    { _id: params.chatId, 'members.userId': { $ne: persona._id } },
    { $push: { members: { userId: persona._id, role: 'member', joinedAt: new Date() } } },
    { returnDocument: 'after' }
  ).lean<Chat | null>();

  return actualizado
    ? { ok: true, chat: actualizado }
    : { ok: false, motivo: 'Esa persona ya está en el grupo.' };
}

/**
 * Sacar a alguien del grupo.
 *
 * Las reglas están en `puedeSacar` (motor puro): solo un admin, nunca a otro
 * admin, y a uno mismo tampoco —para eso está salir—.
 *
 * Devuelve los miembros de ANTES del cambio porque el aviso hay que mandárselo
 * también al que se sacó: si se notifica solo a los que quedan, el grupo le
 * sigue apareciendo en la lista hasta que reabra la app, y sigue viéndolo en un
 * chat donde ya no puede escribir.
 */
export async function removeMember(params: {
  chatId: string;
  quien: Types.ObjectId;
  aQuien: string;
}): Promise<{ ok: true; miembrosPrevios: string[] } | { ok: false; motivo: string }> {
  const chat = await ChatModel.findOne({ _id: params.chatId }).lean<Chat | null>();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

  const decision = puedeSacar({
    quien: String(params.quien),
    aQuien: params.aQuien,
    esGrupo: chat.kind === 'group',
    miembros: chat.members.map((m) => ({
      userId: String(m.userId),
      role: (m.role ?? 'member') as 'admin' | 'member',
    })),
  });
  if (!decision.ok) return { ok: false, motivo: decision.motivo };

  const victima = new Types.ObjectId(params.aQuien);
  // La membresía va en la CONDICIÓN: si entre la lectura y el update la persona
  // ya salió sola, esto no modifica nada y se dice, en vez de contestar que se
  // hizo algo que no pasó.
  const resultado = await ChatModel.updateOne(
    { _id: params.chatId, 'members.userId': victima },
    { $pull: { members: { userId: victima } } }
  );
  if (resultado.matchedCount === 0) {
    return { ok: false, motivo: 'Esa persona ya no está en el grupo.' };
  }

  return { ok: true, miembrosPrevios: chat.members.map((m) => String(m.userId)) };
}

/**
 * Nombrar admin, o dejar de serlo.
 *
 * Las reglas están en `puedeCambiarRol`: nombrar lo puede hacer cualquier admin,
 * pero el admin se lo saca uno mismo —nadie se lo saca a otro— y el único admin
 * no puede renunciar sin nombrar reemplazo.
 */
export async function changeRole(params: {
  chatId: string;
  quien: Types.ObjectId;
  aQuien: string;
  rol: 'admin' | 'member';
}): Promise<{ ok: true; miembros: string[] } | { ok: false; motivo: string }> {
  const chat = await ChatModel.findOne({ _id: params.chatId }).lean<Chat | null>();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

  const decision = puedeCambiarRol({
    quien: String(params.quien),
    aQuien: params.aQuien,
    rol: params.rol,
    esGrupo: chat.kind === 'group',
    miembros: chat.members.map((m) => ({
      userId: String(m.userId),
      role: (m.role ?? 'member') as 'admin' | 'member',
    })),
  });
  if (!decision.ok) return { ok: false, motivo: decision.motivo };

  // El rol ANTERIOR va en la condición: si entre la lectura y el update alguien
  // más lo cambió, esto no pisa esa decisión con una vista vieja.
  const anterior = params.rol === 'admin' ? 'member' : 'admin';
  const resultado = await ChatModel.updateOne(
    {
      _id: params.chatId,
      members: {
        $elemMatch: {
          userId: new Types.ObjectId(params.aQuien),
          // Los miembros viejos no tienen `role` guardado: ausente = «member».
          ...(anterior === 'member'
            ? { $or: [{ role: 'member' }, { role: { $exists: false } }] }
            : { role: 'admin' }),
        },
      },
    },
    { $set: { 'members.$.role': params.rol } }
  );
  if (resultado.matchedCount === 0) {
    return { ok: false, motivo: 'Alguien cambió eso mientras mirabas. Probá de nuevo.' };
  }

  return { ok: true, miembros: chat.members.map((m) => String(m.userId)) };
}

/**
 * Salir de un grupo.
 *
 * **Si se va el último admin se promueve al miembro más antiguo**, en la misma
 * operación. Sin eso queda un grupo que nadie puede administrar nunca más, y eso
 * solo se arregla desde la base.
 */
export async function leaveChat(params: {
  chatId: string;
  quien: Types.ObjectId;
}): Promise<{ ok: true; miembrosRestantes: string[] } | { ok: false; motivo: string }> {
  const chat = await ChatModel.findOne({ _id: params.chatId }).lean<Chat | null>();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

  // El orden de `members` ES la antigüedad: se agregan al final.
  const decision = decidirSalida({
    quien: String(params.quien),
    esGrupo: chat.kind === 'group',
    miembros: chat.members.map((m) => ({
      userId: String(m.userId),
      role: (m.role ?? 'member') as 'admin' | 'member',
    })),
  });
  if (decision.accion === 'imposible') return { ok: false, motivo: decision.motivo };

  await ChatModel.updateOne(
    { _id: params.chatId },
    { $pull: { members: { userId: params.quien } } }
  );

  if (decision.accion === 'salir' && decision.nuevoAdmin) {
    await ChatModel.updateOne(
      { _id: params.chatId, 'members.userId': new Types.ObjectId(decision.nuevoAdmin) },
      { $set: { 'members.$.role': 'admin' } }
    );
  }

  const quedan = chat.members
    .map((m) => String(m.userId))
    .filter((id) => id !== String(params.quien));
  return { ok: true, miembrosRestantes: quedan };
}

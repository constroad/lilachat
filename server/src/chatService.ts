import { Types } from 'mongoose';
import {
  puedeEditar,
  puedeEliminar,
  busquedaValida,
  escaparRegex,
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

/**
 * Texto o archivo EN CLARO a un chat secreto. Hereda de `ForbiddenChatError`
 * para que la cola del cliente lo trate como permanente (403) y lo descarte,
 * en vez de reintentar algo que nunca va a entrar.
 */
export class CifradoRequeridoError extends ForbiddenChatError {
  constructor() {
    super();
    this.message = 'Este chat es secreto: solo acepta mensajes cifrados.';
    this.name = 'CifradoRequeridoError';
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

export type SendResult = {
  message: Message;
  duplicate: boolean;
  /**
   * Los miembros del chat, leídos en el MISMO viaje que reserva el `seq`
   * (FL4). Quien reparte el mensaje los usa en vez de volver a buscarlos. No
   * viene en un duplicado: ese ya se repartió cuando se creó.
   */
  members?: string[];
};

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
  /** La encuesta o el evento que este mensaje publica (`publicarEnElChat`). */
  ref?: Message['ref'];
  replyToSeq?: number;
  /** Auto-respuesta de ausente (F11): se marca para no disparar otra. */
  autoReply?: boolean;
}): Promise<SendResult> {
  const chatId = toObjectId(params.chatId);
  if (!chatId) throw new ForbiddenChatError();

  // Un duplicado devuelve el mensaje propio ya guardado: no filtra nada ajeno,
  // así que no hace falta mirar la membresía antes (un viaje menos).
  const existing = await MessageModel.findOne({
    chatId,
    senderId: params.senderId,
    clientKey: params.clientKey,
  }).lean<Message | null>();
  if (existing) return { message: existing, duplicate: true };

  // `$inc` atómico: es lo que garantiza que dos envíos simultáneos no tomen el
  // mismo número. El índice único {chatId, seq} es el cinturón por si acaso.
  // La MEMBRESÍA va en el filtro: quien no es miembro no consume un `seq`, y
  // el mismo viaje trae los miembros para repartir (antes eran dos lecturas
  // más del chat antes del ack).
  //
  // Sin sobre, el filtro exige además un chat NO cifrado: lo que llega en
  // claro a un chat secreto no consume `seq` ni se guarda (auditoría
  // 17/10/2026 — antes este comentario prometía el corte y el código no lo
  // hacía). Vale para todas las puertas: socket, archivos, auto-respuesta,
  // @lila y programados.
  const chat = await ChatModel.findOneAndUpdate(
    { _id: chatId, 'members.userId': params.senderId, ...(params.envelope ? {} : { encrypted: { $ne: true } }) },
    { $inc: { lastSeq: 1 } },
    { returnDocument: 'after', projection: { lastSeq: 1, 'members.userId': 1 } }
  ).lean<{ lastSeq: number; members: { userId: Types.ObjectId }[] } | null>();
  if (!chat) {
    const esMiembroDeUnSecreto =
      !params.envelope && (await ChatModel.exists({ _id: chatId, 'members.userId': params.senderId, encrypted: true }));
    throw esMiembroDeUnSecreto ? new CifradoRequeridoError() : new ForbiddenChatError();
  }
  const members = chat.members.map((member) => String(member.userId));

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
      ref: params.ref,
      replyToSeq: params.replyToSeq,
      autoReply: params.autoReply ?? false,
      at: new Date(),
    });
    return { message: created.toObject() as Message, duplicate: false, members };
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

/**
 * Hasta qué `seq` borró este miembro el chat (FL9d): lo anterior no le llega
 * por ningún camino —historial, sincronización ni búsqueda—. 0 si nunca.
 */
function borradoHastaDe(chat: { members?: { userId: Types.ObjectId; borradoHasta?: number }[] }, userId: Types.ObjectId): number {
  return chat.members?.find((member) => String(member.userId) === String(userId))?.borradoHasta ?? 0;
}

export async function listMessages(params: {
  chatId: string;
  userId: Types.ObjectId;
  limit?: number;
  beforeSeq?: number;
}): Promise<Message[]> {
  const id = toObjectId(params.chatId);
  const chat = id
    ? await ChatModel.findOne({ _id: id, 'members.userId': params.userId })
        .select('members.userId members.borradoHasta')
        .lean<{ _id: Types.ObjectId; members: { userId: Types.ObjectId; borradoHasta?: number }[] } | null>()
    : null;
  if (!chat) throw new ForbiddenChatError();
  const chatId = chat._id;
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const desde = borradoHastaDe(chat, params.userId);

  // Se pide DESCENDENTE (la página más reciente) y se devuelve ascendente: es
  // el orden en que se lee una conversación.
  const page = await MessageModel.find({
    chatId,
    seq: { $gt: desde, ...(params.beforeSeq ? { $lt: params.beforeSeq } : {}) },
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
  // si se iterara sobre los cursores, un chatId ajeno filtraría mensajes. Con
  // cursores, solo se miran los pedidos (cruzados con la membresía): la app
  // pide el chat abierto, y recorrer todos con cursor 0 le mandaba los 200
  // más viejos de CADA chat en cada apertura. Sin cursores, todos.
  const pedidos = Object.keys(params.cursors).filter((id) => Types.ObjectId.isValid(id));
  const filtro =
    pedidos.length > 0
      ? { _id: { $in: pedidos.map((id) => new Types.ObjectId(id)) }, 'members.userId': params.userId }
      : { 'members.userId': params.userId };
  const chats = await ChatModel.find(filtro)
    .select('_id lastSeq members.userId members.borradoHasta')
    .lean<{ _id: Types.ObjectId; lastSeq?: number; members: { userId: Types.ObjectId; borradoHasta?: number }[] }[]>();

  const batches = await Promise.all(
    chats.map(async (chat) => {
      const chatId = String(chat._id);
      // Lo borrado para mí no vuelve por la sincronización (FL9d).
      const pedido = Number(params.cursors[chatId] ?? 0);
      const since = Math.max(Number.isFinite(pedido) ? pedido : 0, borradoHastaDe(chat, params.userId));
      // Al día: sin consulta. Es el caso normal al abrir un chat ya guardado.
      if (Number.isFinite(since) && (chat.lastSeq ?? 0) <= since) return { chatId, messages: [] };
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

/**
 * Lo que mando yo queda leído por mí, en todos mis dispositivos (como
 * WhatsApp). Sin esto un mensaje propio enviado desde el teléfono contaba como
 * «sin leer» en la web y en el otro teléfono. Sin chequeo de membresía: quien
 * llama acaba de crear el mensaje en ese chat.
 */
export async function marcarPropioLeido(message: Pick<Message, 'chatId' | 'senderId' | 'seq'>): Promise<void> {
  await ReceiptModel.updateOne(
    { chatId: message.chatId, userId: message.senderId },
    { $max: { readSeq: message.seq, deliveredSeq: message.seq } },
    { upsert: true }
  );
}

/**
 * Marca leído hasta `seq`. **Nunca retrocede** (`$max`): dos dispositivos del
 * mismo usuario mandan acuses desordenados, y el que llega tarde no puede
 * resucitar mensajes ya leídos.
 */
/**
 * Mueve el cursor y devuelve si AVANZÓ (FL12, §49 #3): quien re-difunde el
 * acuse no avisa nada cuando no se movió — cada aviso es un re-render en cada
 * teléfono. Se compara contra el documento ANTERIOR (mismo viaje): con
 * `timestamps`, `modifiedCount` da 1 siempre porque `updatedAt` cambia.
 */
async function moverCursor(
  filtro: { chatId: Types.ObjectId; userId: Types.ObjectId },
  campos: ('readSeq' | 'deliveredSeq')[],
  seq: number
): Promise<boolean> {
  const anterior = await ReceiptModel.findOneAndUpdate(
    filtro,
    { $max: Object.fromEntries(campos.map((campo) => [campo, seq])) },
    { upsert: true, new: false, projection: { readSeq: 1, deliveredSeq: 1 } }
  ).lean();
  return !anterior || campos.some((campo) => (anterior[campo] ?? 0) < seq);
}

export async function markRead(params: {
  chatId: string;
  userId: Types.ObjectId;
  seq: number;
}): Promise<boolean> {
  const chatId = await assertMember(params.chatId, params.userId);
  const [avanzo] = await Promise.all([
    // Leer implica entregado: no se puede leer lo que no llego.
    moverCursor({ chatId, userId: params.userId }, ['readSeq', 'deliveredSeq'], params.seq),
    // Abrir el chat quita la marca de «no leído» (FL9), como WhatsApp. El
    // filtro solo encuentra la fila si estaba marcada: no escribe de más.
    ChatModel.updateOne(
      { _id: chatId, members: { $elemMatch: { userId: params.userId, markedUnread: true } } },
      { $set: { 'members.$.markedUnread': false } }
    ),
  ]);
  return avanzo;
}

/**
 * Marcar ENTREGADO —el mensaje llego al telefono— SIN marcarlo leido.
 *
 * Es lo que le faltaba a los checks: sin un acuse de entrega separado, un
 * mensaje saltaba de un check (enviado) a doble check azul (leido) sin pasar por
 * el doble check gris de WhatsApp. `$max` sobre `deliveredSeq` solamente; jamas
 * toca `readSeq`, porque que algo llegue no significa que se haya abierto.
 */
export async function markDelivered(params: {
  chatId: string;
  userId: Types.ObjectId;
  seq: number;
}): Promise<boolean> {
  const chatId = await assertMember(params.chatId, params.userId);
  return moverCursor({ chatId, userId: params.userId }, ['deliveredSeq'], params.seq);
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
 * Editar un mensaje propio (José, 17/10/2026): solo texto y durante 15 minutos,
 * como WhatsApp. El permiso lo decide `shared/editarMensaje.ts` y se comprueba
 * ACÁ: un cliente modificado se saltea la app. Queda `editedAt`, que es lo que
 * hace aparecer «Editado» en la burbuja de todos.
 */
export async function editMessage(params: {
  chatId: string;
  seq: number;
  userId: Types.ObjectId;
  body: string;
}): Promise<{ ok: true; message: Message } | { ok: false; motivo: string }> {
  const chat = await ChatModel.findOne({ _id: params.chatId, 'members.userId': params.userId })
    .select('encrypted')
    .lean<{ encrypted?: boolean } | null>();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

  const mensaje = await MessageModel.findOne({ chatId: params.chatId, seq: params.seq }).lean<Message | null>();
  if (!mensaje) return { ok: false, motivo: 'No encontramos ese mensaje.' };

  const decision = puedeEditar({
    yo: String(params.userId),
    autor: String(mensaje.senderId),
    kind: mensaje.kind,
    eliminado: Boolean(mensaje.deletedAt),
    secreto: Boolean(chat.encrypted),
    enviadoEn: mensaje.at,
    ahora: Date.now(),
  });
  if (!decision.permitido) return { ok: false, motivo: decision.motivo };

  const body = params.body.trim();
  // Vacío no: para eso está eliminar, que deja la lápida.
  if (!body) return { ok: false, motivo: 'El mensaje no puede quedar vacío.' };

  const actualizado = await MessageModel.findOneAndUpdate(
    { chatId: params.chatId, seq: params.seq },
    { $set: { body, editedAt: new Date() } },
    { returnDocument: 'after' }
  ).lean<Message | null>();
  return actualizado ? { ok: true, message: actualizado } : { ok: false, motivo: 'No se pudo editar.' };
}

/**
 * Escribir un aviso EN el chat: «Wilson agregó a Ana», «Cambiaste la foto».
 *
 * No pasa por `sendMessage` por una razón concreta: ese exige que quien manda
 * sea miembro, y el aviso de que ALGUIEN SE FUE se escribe justo cuando dejó de
 * serlo. Lo que sí comparte es lo único que no puede divergir: el `$inc`
 * atómico de `lastSeq`, que es lo que impide que dos mensajes tomen el mismo
 * número.
 *
 * **En un chat cifrado no se escribe nada.** Guardar «Fulano cambió el nombre»
 * en claro dentro de una conversación con candado rompe la promesa del candado
 * por un aviso de cortesía.
 */
export async function escribirAviso(params: {
  chatId: string;
  /** Quién lo hizo. */
  quien: Types.ObjectId;
  evento: string;
  targetId?: string;
  valor?: string;
  /** El texto de respaldo, con los nombres que conoce el server. */
  body: string;
  quien2?: { phone?: string; name?: string };
  aQuien2?: { phone?: string; name?: string };
}): Promise<Message | null> {
  const chat = await ChatModel.findOneAndUpdate(
    { _id: params.chatId, encrypted: { $ne: true } },
    { $inc: { lastSeq: 1 } },
    { returnDocument: 'after' }
  ).lean<{ lastSeq: number } | null>();
  if (!chat) return null;

  const creado = await MessageModel.create({
    chatId: new Types.ObjectId(params.chatId),
    seq: chat.lastSeq,
    senderId: params.quien,
    // Único por evento: estos avisos los genera el server, no se reintentan
    // desde un teléfono, así que no hay nada que deduplicar contra un envío
    // anterior.
    clientKey: `sis-${params.evento}-${chat.lastSeq}`,
    kind: 'system',
    body: params.body,
    system: {
      evento: params.evento,
      targetId: params.targetId,
      valor: params.valor,
      quien: params.quien2,
      aQuien: params.aQuien2,
    },
    at: new Date(),
  });
  return creado.toObject() as Message;
}

/**
 * Lo que el server sabe de alguien, para el aviso.
 *
 * Va el TELÉFONO además del nombre porque el nombre que sirve es el de la
 * agenda de quien mira, y eso solo lo puede resolver el teléfono — la misma
 * razón por la que la lista de chats manda el teléfono en los 1:1.
 */
export async function datosDeUsuario(
  id: Types.ObjectId | string
): Promise<{ name?: string; phone?: string; visible: string }> {
  const persona = await UserModel.findById(id).select('name phone').lean();
  return {
    name: persona?.name ?? undefined,
    phone: persona?.phone,
    visible: persona?.name ?? persona?.phone ?? 'Alguien',
  };
}

export type ResultadoBusqueda = {
  chatId: string;
  messageId: string;
  seq: number;
  body: string;
  senderId: string;
  createdAt: string;
};

/**
 * Buscar texto dentro de las conversaciones DEL USUARIO.
 *
 * **Scope por membresía, siempre**: solo se miran los mensajes de los chats a los
 * que pertenece — nunca los de un chat ajeno. Lo cifrado (`envelope`) se salta:
 * el server no tiene el texto. Solo `kind: 'text'` tiene `body` que buscar.
 *
 * Subcadena case-insensitive (ver `busquedaDeMensajes` en shared). Para una
 * familia el volumen es chico; si algún día crece, va un índice de texto.
 */
export async function buscarMensajes(
  userId: Types.ObjectId,
  consulta: string
): Promise<ResultadoBusqueda[]> {
  if (!busquedaValida(consulta)) return [];

  const chats = await ChatModel.find({ 'members.userId': userId })
    .select('_id members.userId members.borradoHasta')
    .lean<{ _id: Types.ObjectId; members: { userId: Types.ObjectId; borradoHasta?: number }[] }[]>();
  if (chats.length === 0) return [];

  // Cada chat desde donde lo veo: lo borrado para mí no se encuentra (FL9d).
  const regex = new RegExp(escaparRegex(consulta.trim()), 'i');
  const mensajes = await MessageModel.find({
    $or: chats.map((chat) => ({ chatId: chat._id, seq: { $gt: borradoHastaDe(chat, userId) } })),
    kind: 'text',
    envelope: { $exists: false },
    body: regex,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean<(Message & { _id: Types.ObjectId; createdAt?: Date })[]>();

  return mensajes.map((mensaje) => ({
    chatId: String(mensaje.chatId),
    messageId: String(mensaje._id),
    seq: mensaje.seq,
    body: mensaje.body ?? '',
    senderId: String(mensaje.senderId),
    createdAt: mensaje.createdAt?.toISOString() ?? '',
  }));
}

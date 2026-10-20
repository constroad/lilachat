import { Types } from 'mongoose';
import { acuseDelGrupo, TELEFONO_DE_LILA, unreadCount } from '@lilachat/shared';
import { UserModel } from './models.js';
import { ChatModel, MessageModel, ReceiptModel, type Message } from './chatModels.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { fijadosParaLaLista, type FijadoEnLista } from './mensajesFijados.js';

/**
 * La lista de chats de una persona: la primera pantalla de la app. Salió de
 * `chatService.ts`, que pasaba de 900 líneas.
 */
export type ChatSummary = {
  id: string;
  kind: 'direct' | 'group' | 'notas';
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
  /** Los otros miembros cuyo acuse cuenta para mis checks (sin mí ni Lila). */
  acuseDe: string[];
  lastSeq: number;
  unread: number;
  lastMessage: {
    seq: number;
    body?: string;
    kind?: string;
    senderId: string;
    at: Date;
    system?: Message['system'];
    deletedAt?: Date;
  } | null;
  /** Hasta qué `seq` leyeron los DEMÁS: de acá salen los checks del diseño. */
  othersReadSeq: number;
  othersDeliveredSeq: number;
  /** Chat secreto (F9): la lista lo marca con candado y no muestra el último. */
  encrypted?: boolean;
  /** La foto del grupo, ABSOLUTA. Sin foto va vacío y se dibuja la inicial. */
  avatarUrl?: string;
  /** Silenciado por MÍ: la lista lo marca y no me llega push de acá. */
  muted?: boolean;
  /** Fijado por MÍ: va arriba en mi lista. */
  pinned?: boolean;
  /** Archivado por MÍ (FL9). */
  archived?: boolean;
  /** Marcado por MÍ como no leído (FL9). */
  markedUnread?: boolean;
  /** Mensajes fijados arriba del chat (19/10), el más reciente primero. */
  fijados?: FijadoEnLista[];
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

  // TRES consultas en paralelo, y no 2 + N + 1 en serie (FL4): el último
  // mensaje de todos los chats sale de UNA agregación sobre el índice
  // {chatId, seq} —antes era un `findOne` por chat—, y los nombres van en el
  // mismo viaje en vez de esperar a los otros dos.
  const [allReceipts, ultimos, otros, fijados] = await Promise.all([
    ReceiptModel.find({ chatId: { $in: chatIds } }).lean(),
    MessageModel.aggregate<{ _id: Types.ObjectId; ultimo: Message }>([
      { $match: { chatId: { $in: chatIds } } },
      { $sort: { chatId: -1, seq: -1 } },
      { $group: { _id: '$chatId', ultimo: { $first: '$$ROOT' } } },
    ]),
    UserModel.find({ _id: { $in: otrosIds } }).select('name phone avatarUrl').lean(),
    // Los fijados (19/10) en el mismo viaje: casi ningún chat tiene, y sin fijados no consulta.
    fijadosParaLaLista(chats, userId),
  ]);
  const ultimoPorChat = new Map(ultimos.map((fila) => [String(fila._id), fila.ultimo]));
  const lastMessages = chats.map((chat) => ultimoPorChat.get(String(chat._id)) ?? null);
  const personas = new Map(otros.map((user) => [String(user._id), user.name ?? user.phone]));
  const telefonos = new Map(otros.map((user) => [String(user._id), user.phone]));
  const fotos = new Map(otros.map((user) => [String(user._id), user.avatarUrl]));

  const receipts = allReceipts.filter((receipt) => String(receipt.userId) === String(userId));
  const readByChat = new Map(receipts.map((receipt) => [String(receipt.chatId), receipt.readSeq]));
  // Los acuses AJENOS, por chat y por miembro: deciden el check de mis
  // mensajes con `acuseDelGrupo` (el menor; quien nunca abrió el chat vale 0;
  // Lila no cuenta). La app aplica la MISMA regla en vivo (FL8).
  const acusesPorChat = new Map<string, { read: Map<string, number>; delivered: Map<string, number> }>();
  for (const receipt of allReceipts) {
    if (String(receipt.userId) === String(userId)) continue;
    const key = String(receipt.chatId);
    const entrada = acusesPorChat.get(key) ?? { read: new Map(), delivered: new Map() };
    entrada.read.set(String(receipt.userId), receipt.readSeq);
    entrada.delivered.set(String(receipt.userId), receipt.deliveredSeq);
    acusesPorChat.set(key, entrada);
  }

  // Borrado para mí y sin nada nuevo desde entonces: no está en mi lista (FL9d).
  const visibles = chats.flatMap((chat, index) => {
    const yo = chat.members.find((member) => String(member.userId) === String(userId));
    return yo?.borradoHasta !== undefined && yo.borradoHasta >= (chat.lastSeq ?? 0) ? [] : [{ chat, last: lastMessages[index] }];
  });

  return visibles.map(({ chat, last }) => {
    // El subdoc de ESTE usuario: de ahí salen sus flags de silenciado/fijado.
    const acusan = chat.members
      .map((member) => String(member.userId))
      .filter((id) => id !== String(userId) && telefonos.get(id) !== TELEFONO_DE_LILA);
    const acuses = acusesPorChat.get(String(chat._id));
    const yo = chat.members.find((member) => String(member.userId) === String(userId));
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
      // Se guarda RELATIVA y se sirve absoluta, igual que la media de los
      // mensajes: persistir el host dejaría rotas todas las fotos viejas en el
      // proximo cambio de hosting.
      // En un 1:1 la foto ES la del perfil del otro (FL9), como el nombre.
      avatarUrl: (() => {
        const foto = chat.avatarUrl ?? (chat.kind === 'direct' ? fotos.get(otroId) : undefined);
        return foto ? toAbsoluteMediaUrl(foto) : undefined;
      })(),
      muted: yo?.muted === true,
      pinned: yo?.pinned === true,
      archived: yo?.archived === true,
      markedUnread: yo?.markedUnread === true,
      memberIds: chat.members.map((member) => String(member.userId)),
      acuseDe: acusan,
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
            // El aviso viaja entero: la lista tiene que poder resolver el
            // nombre contra la agenda igual que la conversación. Sin esto la
            // vista previa decía «902049935 cambió la foto del grupo», que es
            // exactamente la queja que arregló `nombreDeContacto`.
            system: last.system,
            // Borrado para todos (19/10): sin esto la lista seguía diciendo «Foto».
            ...(last.deletedAt ? { deletedAt: last.deletedAt } : {}),
          }
        : null,
      othersReadSeq: acuseDelGrupo({ otros: acusan, porMiembro: acuses?.read ?? new Map() }),
      othersDeliveredSeq: acuseDelGrupo({ otros: acusan, porMiembro: acuses?.delivered ?? new Map() }),
      ...(fijados.has(String(chat._id)) ? { fijados: fijados.get(String(chat._id)) } : {}),
    };
  });
}

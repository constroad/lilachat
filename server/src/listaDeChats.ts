import { Types } from 'mongoose';
import { acuseDelGrupo, hasDisappeared, listThumbPath, memberPermissionsOf, muteStateOf, notificationLevel, TELEFONO_DE_LILA, unreadCount, type MemberPermissions, type NotificationLevel } from '@lilachat/shared';
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
  /** A 1:1 with an app's bot: which app (design e-23, the «Apps» section). */
  appId?: string;
  memberIds: string[];
  /** Los otros miembros cuyo acuse cuenta para mis checks (sin mí ni Lila). */
  acuseDe: string[];
  lastSeq: number;
  unread: number;
  /** Hasta dónde leí YO: el divisor de no leídos va justo después (auditoría 19/10). */
  readSeq: number;
  lastMessage: {
    seq: number;
    body?: string;
    kind?: string;
    senderId: string;
    at: Date;
    system?: Message['system'];
    deletedAt?: Date;
    /** R31/10-B6: when it disappears; past it the preview is empty. */
    disappearsAt?: Date;
    hiloDe?: number;
    /** A wink's id: the list plays its sound (José, 21/10). */
    wink?: string;
    /** The file's type: a GIF says «GIF» in the list, not «Foto» (pending 53). */
    mime?: string;
    /** The small image beside the preview: a sticker, photo, GIF or video frame (pending 57). Absolute. */
    thumb?: string;
  } | null;
  /** Hasta qué `seq` leyeron los DEMÁS: de acá salen los checks del diseño. */
  othersReadSeq: number;
  othersDeliveredSeq: number;
  /** Chat secreto (F9): la lista lo marca con candado y no muestra el último. */
  encrypted?: boolean;
  /** La foto del grupo, ABSOLUTA. Sin foto va vacío y se dibuja la inicial. */
  avatarUrl?: string;
  /** El chat contigo («Tú», 20/10). */
  propio?: boolean;
  /** E2: a channel of the space (its `name` is the slug). */
  channel?: { visibility: 'public' | 'private' };
  /** Nudges and winks switched on by an admin of the group (José, 21/10). */
  funAllowed?: boolean;
  memberPermissions?: MemberPermissions;
  birthdaysOn?: boolean;
  /** Silenciado por MÍ: la lista lo marca y no me llega push de acá. */
  muted?: boolean;
  /** R31/10: when my «8 horas» or «1 semana» silence ends. */
  mutedUntil?: string;
  /** E3b: «todo», «menciones» or «nada» (from muted + avisos). */
  avisos?: NotificationLevel;
  /** Fijado por MÍ: va arriba en mi lista. */
  pinned?: boolean;
  /** Archivado por MÍ (FL9). */
  archived?: boolean;
  /** Marcado por MÍ como no leído (FL9). */
  markedUnread?: boolean;
  /** Mensajes fijados arriba del chat (19/10), el más reciente primero. */
  fijados?: FijadoEnLista[];
};

/** `workspaceId`: the chats of that company space; without it, the personal ones (E1). */
/** Pending 57: the preview's small image, never in a secret chat (its media is not the list's to show). */
function thumbFor(last: Message, secret: boolean): { thumb?: string } {
  const path = secret ? undefined : listThumbPath(last);
  return path ? { thumb: toAbsoluteMediaUrl(path) } : {};
}

export async function listChats(userId: Types.ObjectId, workspaceId?: Types.ObjectId): Promise<ChatSummary[]> {
  const chats = await ChatModel.find({ 'members.userId': userId, workspaceId: workspaceId ?? { $exists: false } }).lean();
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
  const [allReceipts, ultimos, otros, fijados, yoUsuario] = await Promise.all([
    ReceiptModel.find({ chatId: { $in: chatIds } }).lean(),
    MessageModel.aggregate<{ _id: Types.ObjectId; ultimo: Message }>([
      { $match: { chatId: { $in: chatIds } } },
      { $sort: { chatId: -1, seq: -1 } },
      { $group: { _id: '$chatId', ultimo: { $first: '$$ROOT' } } },
    ]),
    UserModel.find({ _id: { $in: otrosIds } }).select('name phone avatarUrl app.appId readReceiptsOff').lean(),
    // Los fijados (19/10) en el mismo viaje: casi ningún chat tiene, y sin fijados no consulta.
    fijadosParaLaLista(chats, userId),
    // R31/10: my «Confirmaciones de lectura»; off, I do not see the others' «leído» in a 1:1 either.
    UserModel.findById(userId).select('readReceiptsOff').lean(),
  ]);
  const ultimoPorChat = new Map(ultimos.map((fila) => [String(fila._id), fila.ultimo]));
  const lastMessages = chats.map((chat) => ultimoPorChat.get(String(chat._id)) ?? null);
  const personas = new Map(otros.map((user) => [String(user._id), user.name ?? user.phone]));
  const telefonos = new Map(otros.map((user) => [String(user._id), user.phone]));
  const fotos = new Map(otros.map((user) => [String(user._id), user.avatarUrl]));
  // The 1:1 with an app's bot goes to the space's «Apps» section, not to its direct messages (design e-23).
  const apps = new Map(otros.flatMap((user) => (user.app?.appId ? [[String(user._id), String(user.app.appId)] as const] : [])));

  // R31/10: in a 1:1 where either side turned read receipts off, nobody sees «leído» (`readPrivacy.ts`).
  const hidesRead = new Set(otros.filter((user) => user.readReceiptsOff === true).map((user) => String(user._id)));
  const iHideRead = yoUsuario?.readReceiptsOff === true;
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
      ...(chat.kind === 'direct' && apps.has(otroId) ? { appId: apps.get(otroId) } : {}),
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
      ...(chat.propio ? { propio: true } : {}),
      ...(chat.channel ? { channel: { visibility: chat.channel.visibility } } : {}),
      ...(chat.funAllowed ? { funAllowed: true } : {}),
      // Pending 8: only when an admin changed them, so the composer knows who may write.
      ...(chat.memberPermissions ? { memberPermissions: memberPermissionsOf(chat.memberPermissions) } : {}),
      ...(chat.birthdaysOn ? { birthdaysOn: true } : {}),
      ...muteStateOf(yo),
      avisos: notificationLevel(yo ?? {}),
      pinned: yo?.pinned === true,
      archived: yo?.archived === true,
      markedUnread: yo?.markedUnread === true,
      memberIds: chat.members.map((member) => String(member.userId)),
      acuseDe: acusan,
      lastSeq: chat.lastSeq,
      readSeq: readByChat.get(String(chat._id)) ?? 0,
      // Only what the main chat shows counts (pending 108): a thread reply has its own chip.
      unread: unreadCount({
        lastSeq: chat.lastMainSeq ?? chat.lastSeq,
        readSeq: readByChat.get(String(chat._id)) ?? 0,
      }),
      // R31/10-B6: a last message whose time passed shows nothing, not its text nor a tombstone.
      lastMessage: last && hasDisappeared(last)
        ? { seq: last.seq, kind: last.kind, senderId: String(last.senderId), at: last.at, disappearsAt: last.disappearsAt }
        : last
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
            // E3: el último fue una respuesta en un hilo (la vista previa lo dice).
            ...(last.hiloDe ? { hiloDe: last.hiloDe } : {}),
            ...(last.wink ? { wink: last.wink } : {}),
            ...(last.media?.mime ? { mime: last.media.mime } : {}),
            ...thumbFor(last, chat.encrypted === true),
          }
        : null,
      othersReadSeq: chat.kind === 'direct' && (iHideRead || acusan.some((id) => hidesRead.has(id))) ? 0 : acuseDelGrupo({ otros: acusan, porMiembro: acuses?.read ?? new Map() }),
      othersDeliveredSeq: acuseDelGrupo({ otros: acusan, porMiembro: acuses?.delivered ?? new Map() }),
      ...(fijados.has(String(chat._id)) ? { fijados: fijados.get(String(chat._id)) } : {}),
    };
  });
}

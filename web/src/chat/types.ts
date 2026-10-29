import type { LiveLocation } from '@lilachat/shared';
import type { BotCard } from '@lilachat/shared';
import type { MencionEnMensaje, NotificationLevel, OutboxItem, Reaccion, ResumenDeHiloEnCliente, VistaDelFijado } from '@lilachat/shared';

/**
 * Las formas que devuelve el server, copiadas de `server/src/listaDeChats.ts`
 * y `server/src/messageView.ts` — no recordadas.
 *
 * Hasta W1 (19/10/2026) la web leía `createdAt`, un campo que el server nunca
 * mandó (es `at`): la hora y el chip del día salían vacíos. Los tipos describían
 * un contrato inventado y TypeScript no puede saber eso.
 *
 * `online` y `typingName` NO vienen del endpoint: los pinta el socket sobre la
 * lista ya cargada.
 */
export type ChatSummary = {
  id: string;
  kind: 'direct' | 'group' | 'notas';
  /** A chat of a company space, and a channel there (E1/E2): always in the Slack format. */
  workspaceId?: string;
  /** A 1:1 with an app's bot (design e-23): it goes to «Apps», not to the direct messages. */
  appId?: string;
  channel?: { visibility: string };
  /** El chat contigo («Tú · Envíate un mensaje», 20/10). */
  propio?: boolean;
  name?: string;
  /** El teléfono de la otra persona, solo en chats 1:1. */
  phone?: string;
  memberIds: string[];
  /** Los otros miembros cuyo acuse cuenta para mis checks. */
  acuseDe?: string[];
  lastSeq: number;
  unread: number;
  lastMessage: {
    seq: number;
    body?: string;
    kind?: string;
    senderId: string;
    at: string;
    /** Un aviso: la lista arma la frase como la conversación (W3b). */
    system?: ChatMessage['system'];
    /** Borrado para todos (19/10): la vista previa lo dice. */
    deletedAt?: string;
    /** E3: fue una respuesta en un hilo. */
    /** A wink's id: the list plays its sound (José, 21/10). */
    wink?: string;
    hiloDe?: number;
    /** The file's type: a GIF says «GIF», not «Foto» (pending 53). */
    mime?: string;
    /** The small image beside the preview: sticker, photo, GIF or video frame (pending 57). */
    thumb?: string;
  } | null;
  othersReadSeq: number;
  othersDeliveredSeq: number;
  encrypted?: boolean;
  avatarUrl?: string;
  /** Nudges and winks switched on by an admin of the group (José, 21/10). */
  funAllowed?: boolean;
  /** Birthdays on in this chat (pending 17). */
  birthdaysOn?: boolean;
  muted?: boolean;
  /** E3b: todo / menciones / nada (from the server; older data only has `muted`). */
  avisos?: NotificationLevel;
  pinned?: boolean;
  archived?: boolean;
  markedUnread?: boolean;
  /** Mensajes fijados arriba del chat (19/10), el más reciente primero. */
  fijados?: FijadoEnLista[];
  online?: boolean;
  typingName?: string | null;
};

/** Un fijado como lo manda la lista (`server/src/mensajesFijados.ts`). */
export type FijadoEnLista = { seq: number; por: string; en: string; hasta: string; vista: VistaDelFijado };

export type MessageRef = { tipo: 'encuesta' | 'evento' | 'recordatorio' | 'checklist'; id: string };

export type ChatMessage = {
  _id?: string;
  chatId: string;
  seq: number;
  senderId: string;
  clientKey: string;
  kind: string;
  body?: string;
  /** A wink's id (kind `guino`, José 21/10). */
  wink?: string;
  /** A shared contact (kind `contact`, pending 9): `userId` when that number is on Lilachat. */
  contact?: { name: string; phone: string; userId?: string };
  /** A shared location (kind `location`, pending 11). */
  location?: LiveLocation;
  /** A bot's card (`specs/BOTS-API.spec.md` §b): `body` carries its summary. */
  card?: BotCard;
  /** An app's answer sent to the channel by who asked: «José usó /clima» on top. */
  sharedBy?: { name: string; command: string };
  /** El sobre de un chat secreto: llega EN VEZ de `body`. La web no lo abre. */
  envelope?: { v: number; nonce: string; ciphertext: string };
  ref?: MessageRef;
  menciones?: MencionEnMensaje[];
  /** E3: respuesta en el hilo de este `seq`; `enElChat` = también en el chat. */
  hiloDe?: number;
  enElChat?: boolean;
  /** En la raíz: el resumen de su hilo. */
  hilo?: ResumenDeHiloEnCliente;
  /** Reacciones (20/10): una por persona. */
  reacciones?: Reaccion[];
  media?: {
    mediaId?: string;
    url?: string;
    thumbUrl?: string;
    mime?: string;
    fileName?: string;
    sizeBytes?: number;
    durationMs?: number;
    width?: number;
    height?: number;
    onda?: number[];
    /** An animated sticker of my own (pending 37). */
    animated?: boolean;
    /** Sent together with other photos (pending 12): drawn as one card. */
    album?: string;
  };
  /** Un aviso del server (W3/19-10): la frase se arma acá, con los nombres de quien mira. */
  system?: { evento: string; valor?: string; targetId?: string; quien?: { phone?: string; name?: string }; aQuien?: { phone?: string; name?: string } };
  deletedAt?: string;
  replyToSeq?: number;
  editedAt?: string;
  at: string;
};

/**
 * Lo que se dibuja: un mensaje del server o uno de la cola que todavía no
 * confirmó (`estado`). Viven en tablas distintas de la base local y se juntan
 * recién al pintar.
 */
export type MensajeEnPantalla = ChatMessage & {
  estado?: 'enviando' | 'fallido';
  motivoDelFallo?: string;
  /** 0→1 de un archivo que sube (19/10): el anillo sobre la foto. */
  progreso?: number;
};

/** Un ítem de la cola, con la hora local para ordenar lo pendiente. */
export type EnvioPendiente = OutboxItem;

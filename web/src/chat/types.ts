import type { MencionEnMensaje, OutboxItem, VistaDelFijado } from '@lilachat/shared';

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
  } | null;
  othersReadSeq: number;
  othersDeliveredSeq: number;
  encrypted?: boolean;
  avatarUrl?: string;
  muted?: boolean;
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

export type RefDeMensaje = { tipo: 'encuesta' | 'evento' | 'recordatorio'; id: string };

export type ChatMessage = {
  _id?: string;
  chatId: string;
  seq: number;
  senderId: string;
  clientKey: string;
  kind: string;
  body?: string;
  /** El sobre de un chat secreto: llega EN VEZ de `body`. La web no lo abre. */
  envelope?: { v: number; nonce: string; ciphertext: string };
  ref?: RefDeMensaje;
  menciones?: MencionEnMensaje[];
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
};

/** Un ítem de la cola, con la hora local para ordenar lo pendiente. */
export type EnvioPendiente = OutboxItem;

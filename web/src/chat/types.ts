/**
 * Las formas que devuelve el server, más lo que la web le agrega en vivo.
 *
 * `online` y `typingName` NO vienen del endpoint: los pinta el socket sobre la
 * lista ya cargada. Se marcan opcionales por eso — al montar todavía no se sabe
 * quién está conectado, y pintar «desconectado» antes del `presence.snapshot`
 * sería mentir durante el primer segundo.
 */
export type ChatSummary = {
  id: string;
  kind: 'direct' | 'group';
  name?: string;
  memberIds: string[];
  lastSeq: number;
  unread: number;
  lastMessage: { seq: number; body?: string; kind?: string; senderId: string; at: string } | null;
  othersReadSeq: number;
  othersDeliveredSeq: number;
  online?: boolean;
  typingName?: string | null;
};

export type ChatMessage = {
  _id?: string;
  chatId: string;
  seq: number;
  senderId: string;
  kind: 'text' | 'image' | 'video' | 'file';
  body?: string;
  clientKey: string;
  createdAt: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  /** Solo en el cliente: el que todavía no confirmó el server. */
  pending?: boolean;
};

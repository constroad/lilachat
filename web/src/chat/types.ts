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
  /**
   * El adjunto, con los nombres que MANDA el server.
   *
   * La web declaraba `mediaUrl` y `thumbnailUrl` —campos que no existen— así
   * que una foto llegaba, se guardaba bien y se pintaba como una burbuja
   * VACÍA. Nadie lo vio hasta subir una de verdad (27/08/2026): el tipo
   * describía un contrato inventado y TypeScript no puede saber eso.
   */
  media?: { url: string; thumbUrl?: string; mime?: string; mediaId?: string };
  /**
   * El sobre cifrado de un chat secreto.
   *
   * El server lo manda desde F9 y el tipo de la web no lo modelaba: la web no
   * sabe descifrar todavía, pero SÍ tiene que reconocerlo — es lo que impide
   * que la caché guarde en claro un mensaje que se cifró a propósito.
   */
  envelope?: { v: number; nonce: string; ciphertext: string };
  /** Solo en el cliente: el que todavía no confirmó el server. */
  pending?: boolean;
};

import type { ChatSummary } from '../api/client';

/** Lo que trae un `msg.new` y le importa a la lista. */
export type MensajeEnVivo = {
  chatId: string;
  seq: number;
  senderId: string;
  kind?: string;
  body?: string;
  at: string;
  system?: NonNullable<ChatSummary['lastMessage']>['system'];
};

/**
 * Aplica un `msg.new` a la lista de chats, sin ir al server.
 *
 * Antes cada mensaje entrante recargaba la lista entera por HTTP (tres viajes a
 * la base más uno por chat) para cambiar una fila. Ahora se cambia esa fila.
 *
 * Devuelve `null` si el chat no está en la lista: es una conversación nueva y
 * solo el server sabe su nombre y sus miembros. Un duplicado devuelve la MISMA
 * lista, y los chats que no cambian conservan su referencia: así la fila
 * memoizada no se vuelve a dibujar.
 */
export function aplicarMensajeALista(
  chats: ChatSummary[],
  mensaje: MensajeEnVivo,
  yo: string
): ChatSummary[] | null {
  const indice = chats.findIndex((chat) => chat.id === mensaje.chatId);
  if (indice === -1) return null;
  const actual = chats[indice];
  if (!actual || mensaje.seq <= actual.lastSeq) return chats;

  const esMio = String(mensaje.senderId) === yo;
  const actualizado: ChatSummary = {
    ...actual,
    lastSeq: mensaje.seq,
    unread: esMio ? actual.unread : actual.unread + 1,
    lastMessage: {
      seq: mensaje.seq,
      // Un sobre cifrado no trae `body`: la vista previa queda sin texto.
      body: mensaje.body,
      kind: mensaje.kind,
      senderId: String(mensaje.senderId),
      at: mensaje.at,
      system: mensaje.system,
    },
  };
  return chats.map((chat, i) => (i === indice ? actualizado : chat));
}

/**
 * El chat abierto vive en la URL (`/c/<id>`, W1): así sirven atrás y adelante,
 * recargar deja el mismo chat y el aviso abre el correcto. `?chat=<id>` es el
 * enlace que mandaban los avisos antes y se sigue entendiendo.
 */
const ID_DE_MONGO = /^[a-f\d]{24}$/i;

export function chatDeLaRuta(pathname: string, search: string): string | null {
  const enLaRuta = /^\/c\/([^/]+)\/?$/.exec(pathname)?.[1];
  const candidato = enLaRuta ?? new URLSearchParams(search).get('chat');
  return candidato && ID_DE_MONGO.test(candidato) ? candidato : null;
}

export const rutaDelChat = (chatId: string | null): string => (chatId ? `/c/${chatId}` : '/');

/** Opens a chat from anywhere (pending 9: «Enviar mensaje» on a shared contact): the URL changes and `useChatDeLaUrl` follows it. */
export function openChatFromAnywhere(chatId: string): void {
  history.pushState(null, '', rutaDelChat(chatId));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

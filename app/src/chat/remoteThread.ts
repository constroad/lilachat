/**
 * What the server answered for a whole thread (`GET /chats/:id/hilos/:raiz`), checked: a 200 whose body lacks the
 * list (a cut or foreign body during a restart) took the chat down with «Cannot convert undefined value to object»
 * (lilachat 0.1.190, José 27/11). Anything that is not a list is an empty thread.
 */
export function remoteThreadOf<M>(body: unknown): { raiz: M | null; respuestas: M[] } {
  const data = body && typeof body === 'object' ? (body as { raiz?: unknown; respuestas?: unknown }) : {};
  return {
    raiz: data.raiz && typeof data.raiz === 'object' ? (data.raiz as M) : null,
    respuestas: Array.isArray(data.respuestas) ? (data.respuestas as M[]) : [],
  };
}

/**
 * Los errores de la mensajería (salieron de `chatService` el 20/10 para que
 * otros módulos —acuses, hilos— los usen sin importar el servicio entero).
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

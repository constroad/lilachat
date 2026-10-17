/**
 * Adónde lleva tocar una notificación (FL8). Puro: lo que trae el `data` de la
 * notificación —push del server o aviso local— decide la pantalla.
 *
 * - `tipo: 'agenda'` (recordatorio o evento) → la pestaña Agenda.
 * - un `chatId` válido → ese chat.
 *
 * El `data` viene de afuera (FCM), así que se valida: un `chatId` que no tiene
 * forma de id de Mongo no se usa para navegar.
 */
export type DestinoDeAviso = { tipo: 'chat'; chatId: string } | { tipo: 'agenda' };

const ID_DE_MONGO = /^[a-f0-9]{24}$/;

export function destinoDeAviso(data: unknown): DestinoDeAviso | null {
  if (!data || typeof data !== 'object') return null;
  const { chatId, tipo } = data as { chatId?: unknown; tipo?: unknown };
  if (tipo === 'agenda') return { tipo: 'agenda' };
  if (typeof chatId === 'string' && ID_DE_MONGO.test(chatId)) return { tipo: 'chat', chatId };
  return null;
}

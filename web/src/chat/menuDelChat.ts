import { accionesDeSeleccion } from '@lilachat/shared';
import type { ChatSummary } from './types';

/**
 * El menú de cada fila de la lista (W3a), como WhatsApp Web. Qué ofrece lo
 * decide el MISMO motor que la selección múltiple de la app
 * (`accionesDeSeleccion`), aplicado a un solo chat.
 */
export type AccionDelChat = 'archivar' | 'desarchivar' | 'silenciar' | 'reactivar' | 'fijar' | 'desfijar' | 'leido' | 'no-leido' | 'salir' | 'eliminar';
export type OpcionDelMenu = { accion: AccionDelChat; etiqueta: string; peligro?: boolean };
export type CambiosDeAjustes = { archived?: boolean; muted?: boolean; pinned?: boolean; markedUnread?: boolean };

const ETIQUETAS: Record<AccionDelChat, string> = {
  archivar: 'Archivar chat',
  desarchivar: 'Desarchivar chat',
  silenciar: 'Silenciar notificaciones',
  reactivar: 'Activar notificaciones',
  fijar: 'Fijar chat',
  desfijar: 'Desfijar chat',
  leido: 'Marcar como leído',
  'no-leido': 'Marcar como no leído',
  salir: 'Salir del grupo',
  eliminar: 'Eliminar chat',
};

export function opcionesDelMenuDeChat(chat: ChatSummary): OpcionDelMenu[] {
  const posibles = accionesDeSeleccion([
    {
      id: chat.id,
      esGrupo: chat.kind === 'group',
      muted: Boolean(chat.muted),
      pinned: Boolean(chat.pinned),
      unread: chat.unread,
      fechaOrden: 0,
      archived: chat.archived,
      marcadoNoLeido: chat.markedUnread,
    },
  ]);
  const acciones: (AccionDelChat | null)[] = [
    posibles.archivar,
    // Un borrador es solo tuyo: nunca suena, no hay qué silenciar.
    chat.kind === 'notas' ? null : posibles.silenciar,
    posibles.fijar,
    posibles.lectura,
    posibles.salir ? 'salir' : null,
    posibles.eliminar ? 'eliminar' : null,
  ];
  return acciones
    .filter((accion): accion is AccionDelChat => accion !== null)
    .map((accion) => ({ accion, etiqueta: ETIQUETAS[accion], ...(accion === 'salir' || accion === 'eliminar' ? { peligro: true } : {}) }));
}

/** Lo que manda `PATCH /chats/:id/ajustes`; `null` para lo que no es un ajuste. Archivar desfija, como WhatsApp. */
export function cambiosDeAjustes(accion: AccionDelChat): CambiosDeAjustes | null {
  switch (accion) {
    case 'archivar':
      return { archived: true, pinned: false };
    case 'desarchivar':
      return { archived: false };
    case 'silenciar':
      return { muted: true };
    case 'reactivar':
      return { muted: false };
    case 'fijar':
      return { pinned: true };
    case 'desfijar':
      return { pinned: false };
    case 'no-leido':
      return { markedUnread: true };
    case 'leido':
      return { markedUnread: false };
    default:
      return null;
  }
}

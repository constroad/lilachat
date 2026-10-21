import { createContext, useContext } from 'react';
import type { AgendaReminder } from '@lilachat/shared';
import type { DetalleDelChat } from './useDetalleDelChat';
import type { ChatSummary, MensajeEnPantalla } from './types';

/** Lo que se puede pedir sobre un mensaje desde su menú (W2). */
export type AccionSobreMensaje = 'responder' | 'hilo' | 'copiar' | 'reenviar' | 'editar' | 'info' | 'eliminar' | 'fijar' | 'desfijar' | 'destacar' | 'quitarDestacado';
/** What the menu of a sticker offers (20/10): keep it in «Mis stickers» or as a favorite. */
export type StickerAction = 'keep' | 'favorite';

/**
 * Lo que las burbujas necesitan del chat abierto, sin pasarlo por cada nivel
 * (Conversación → lista virtualizada → fila → burbuja → menú).
 */
export type ContextoDeLaConversacion = {
  yo: string;
  jwt: string;
  chat: ChatSummary;
  detalle: DetalleDelChat | null;
  /** id → nombre que ve esta persona, para autores y menciones. */
  nombres: ReadonlyMap<string, string>;
  /** Inside the thread panel: replies there do not show «Respondió en un hilo». */
  inThread?: boolean;
  /** Member photos for the thread chip and root (backlog 18: only initials showed). */
  photos?: ReadonlyMap<string, string>;
  /** El mensaje citado por `replyToSeq`, si está cargado. */
  citado: (seq: number) => MensajeEnPantalla | undefined;
  onAccion: (mensaje: MensajeEnPantalla, accion: AccionSobreMensaje) => void;
  /** Abrir una foto en el visor del chat. */
  onVerFoto: (mensaje: MensajeEnPantalla) => void;
  /** Fijar mensajes (19/10): en un grupo, solo los admins. */
  puedeFijar: boolean;
  fijados: ReadonlySet<number>;
  /** E3: abrir el hilo de una raíz, y si tiene respuestas que no vi. Sin esto (en el panel del hilo), no hay chip. */
  onAbrirHilo?: (seq: number) => void;
  hiloConNuevas?: (seq: number) => boolean;
  /** Reaccionar (20/10). Sin esto (chat secreto), no hay botón. */
  onReaccionar?: (seq: number, emoji: string | null) => void;
  /** Los que destaqué (20/10): estrella en el pie y «Destacar / Quitar» en el menú. */
  destacados?: ReadonlySet<number>;
  /** Keep a sticker from the chat (20/10). Without it (secret chat), the menu does not offer it. */
  onStickerAction?: (mensaje: MensajeEnPantalla, action: StickerAction) => void;
  /** Editar un recordatorio del chat (W3c). Sin esto (sin permiso), la tarjeta no ofrece editar. */
  onEditarRecordatorio?: (recordatorio: AgendaReminder) => void;
};

export const ConversacionContext = createContext<ContextoDeLaConversacion | null>(null);

export function useConversacion(): ContextoDeLaConversacion {
  const contexto = useContext(ConversacionContext);
  if (!contexto) throw new Error('useConversacion fuera de una conversación');
  return contexto;
}

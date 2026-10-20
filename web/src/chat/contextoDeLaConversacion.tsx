import { createContext, useContext } from 'react';
import type { DetalleDelChat } from './useDetalleDelChat';
import type { ChatSummary, MensajeEnPantalla } from './types';

/** Lo que se puede pedir sobre un mensaje desde su menú (W2). */
export type AccionSobreMensaje = 'responder' | 'hilo' | 'copiar' | 'reenviar' | 'editar' | 'info' | 'eliminar' | 'fijar' | 'desfijar';

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
};

export const ConversacionContext = createContext<ContextoDeLaConversacion | null>(null);

export function useConversacion(): ContextoDeLaConversacion {
  const contexto = useContext(ConversacionContext);
  if (!contexto) throw new Error('useConversacion fuera de una conversación');
  return contexto;
}

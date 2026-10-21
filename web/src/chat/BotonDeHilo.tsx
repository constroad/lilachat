import { MessagesSquare } from 'lucide-react';
import { canOpenThread } from '@lilachat/shared';
import { useConversacion } from './contextoDeLaConversacion';
import type { MensajeEnPantalla } from './types';

/**
 * «Responder en hilo» al pasar el mouse, junto al de reaccionar (José, 20/10:
 * en la app quedó bajo los emojis; acá estaba solo dentro del menú).
 */
export function BotonDeHilo({ mensaje }: { mensaje: MensajeEnPantalla }) {
  const { chat, onAbrirHilo } = useConversacion();
  if (!onAbrirHilo || mensaje.estado) return null;
  if (!canOpenThread({ seq: mensaje.seq, kind: mensaje.kind, system: mensaje.system, hiloDe: mensaje.hiloDe, deletedAt: mensaje.deletedAt, cifrado: chat.encrypted })) return null;
  return (
    <button
      type="button"
      data-testid={`hilo-${mensaje.clientKey}`}
      aria-label="Responder en hilo"
      title="Responder en hilo"
      onClick={() => onAbrirHilo(mensaje.seq)}
      className="grid h-8 w-8 shrink-0 place-items-center self-center rounded-full border border-outline/15 bg-surface text-on-surface-variant opacity-0 shadow-sm transition-opacity hover:text-primary focus:opacity-100 group-hover:opacity-100"
    >
      <MessagesSquare size={16} />
    </button>
  );
}

import { Types } from 'mongoose';
import { chatMemberIds } from './chatService.js';

/**
 * Las tarjetas del chat (encuesta, evento, recordatorio del grupo) en vivo
 * (José, 19/10). Cada cambio —voto, edición, imagen, cierre, borrado— avisa
 * `ref.changed` a TODOS los miembros del chat, y la tarjeta se vuelve a pedir.
 * Antes se pedía solo al montarse: un voto o un borrado se veía al reabrir.
 */
export type CambioDeTarjeta = { chatId: string; tipo: 'encuesta' | 'evento' | 'recordatorio' | 'checklist'; id: string };

/** Cómo se reparte por el socket; lo cablea `socket.ts`. */
let emitir: ((userId: string, cambio: CambioDeTarjeta) => void) | null = null;

export function configurarAvisoDeTarjeta(fn: (userId: string, cambio: CambioDeTarjeta) => void): void {
  emitir = fn;
}

/**
 * Avisar el cambio. Va DESPUÉS de responder y nunca lanza: el cambio ya está
 * guardado, y un aviso que falla solo deja la tarjeta como estaba.
 */
export async function avisarCambioDeTarjeta(cambio: { chatId?: unknown; tipo: CambioDeTarjeta['tipo']; id: unknown }): Promise<void> {
  if (!emitir || !cambio.chatId || !Types.ObjectId.isValid(String(cambio.chatId))) return;
  try {
    const frame: CambioDeTarjeta = { chatId: String(cambio.chatId), tipo: cambio.tipo, id: String(cambio.id) };
    for (const miembro of await chatMemberIds(new Types.ObjectId(frame.chatId))) emitir(miembro, frame);
  } catch (error) {
    console.error('[tarjeta] no se pudo avisar el cambio:', error instanceof Error ? error.message : error);
  }
}

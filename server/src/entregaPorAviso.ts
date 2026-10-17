import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { chatMemberIds, markDelivered } from './chatService.js';
import { resolveJwtSecret } from './sessions.js';

/**
 * El doble check sin abrir la app (FL8.2).
 *
 * «Entregado» lo marcaba la app al conectarse. Con la app cerrada el push
 * llegaba al teléfono, pero era una notificación común: Android la dibujaba
 * sin ejecutar nada de la app y el server nunca se enteraba (José, chat con
 * Wilson: un solo check aunque Wilson tenía internet). Ahora el push es
 * solo-datos, lo recibe el servicio nativo y confirma con ESTE token: corto,
 * de ese mensaje y esa persona, firmado con un secreto derivado para que no
 * sirva como sesión (el teléfono no tiene el JWT a mano con la app cerrada).
 */
const AUDIENCIA = 'entrega-mensaje';
/** Un push puede quedar en cola días si el teléfono estuvo apagado. */
const VIDA_DEL_TOKEN_S = 7 * 24 * 3600;
const secreto = () => `${resolveJwtSecret()}:${AUDIENCIA}`;

export function firmarEntrega(params: { chatId: string; userId: string; seq: number }): string {
  return jwt.sign({ c: params.chatId, u: params.userId, s: params.seq }, secreto(), {
    audience: AUDIENCIA,
    expiresIn: VIDA_DEL_TOKEN_S,
  });
}

export function verificarEntrega(token: string): { chatId: string; userId: string; seq: number } | null {
  try {
    const claims = jwt.verify(token, secreto(), { audience: AUDIENCIA }) as { c?: unknown; u?: unknown; s?: unknown };
    if (typeof claims.c !== 'string' || typeof claims.u !== 'string' || typeof claims.s !== 'number') return null;
    return { chatId: claims.c, userId: claims.u, seq: claims.s };
  } catch {
    return null;
  }
}

/** Cómo se reparte el acuse por el socket; lo cablea `socket.ts`. */
let emitirAcuse: ((userId: string, frame: object) => void) | null = null;

export function configurarEntrega(emitir: (userId: string, frame: object) => void): void {
  emitirAcuse = emitir;
}

/**
 * Marca entregado y avisa a los del chat. `markDelivered` exige membresía y
 * usa `$max`: un push viejo que llega tarde no baja el acuse.
 */
export async function confirmarEntregaDesdeAviso(token: string): Promise<boolean> {
  const entrega = verificarEntrega(token);
  if (!entrega || !Types.ObjectId.isValid(entrega.chatId) || !Types.ObjectId.isValid(entrega.userId)) return false;
  try {
    await markDelivered({ chatId: entrega.chatId, userId: new Types.ObjectId(entrega.userId), seq: entrega.seq });
  } catch {
    // Ya no es del chat (lo sacaron) o el chat no existe: no hay qué acusar.
    return false;
  }
  const members = await chatMemberIds(new Types.ObjectId(entrega.chatId));
  for (const member of members) {
    emitirAcuse?.(member, { chatId: entrega.chatId, userId: entrega.userId, deliveredSeq: entrega.seq });
  }
  return true;
}

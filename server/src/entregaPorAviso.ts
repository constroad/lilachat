import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { chatMemberIds, markDelivered } from './chatService.js';
import { resolveJwtSecret } from './sessions.js';
import { broadcastReceipt, type ReceiptFrame } from './readPrivacy.js';
import { registro } from './registro.js';

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

type Entrega = { chatId: string; userId: string; seq: number; sentAt?: number };
const MS_PER_S = 1000;

export function verifyDelivery(token: string): Entrega | null {
  try {
    const claims = jwt.verify(token, secreto(), { audience: AUDIENCIA }) as { c?: unknown; u?: unknown; s?: unknown; iat?: unknown };
    if (typeof claims.c !== 'string' || typeof claims.u !== 'string' || typeof claims.s !== 'number') return null;
    // The token is signed when the push goes out: its `iat` is the sending time.
    return { chatId: claims.c, userId: claims.u, seq: claims.s, ...(typeof claims.iat === 'number' ? { sentAt: claims.iat * MS_PER_S } : {}) };
  } catch {
    return null;
  }
}

/**
 * lila-2 16/11: José's photos in #planta never showed and nothing said whether
 * the phone even acknowledged them. One line per ack, with the delay since sending.
 */
export function deliveryAckLine(entrega: Entrega, now: number): string {
  const head = `[push] aviso acusado chat=${entrega.chatId} seq=${entrega.seq} user=${entrega.userId}`;
  if (entrega.sentAt === undefined) return `${head} sin hora de envío`;
  return `${head} a ${((now - entrega.sentAt) / MS_PER_S).toFixed(1)} s del envío`;
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
  const entrega = verifyDelivery(token);
  if (!entrega || !Types.ObjectId.isValid(entrega.chatId) || !Types.ObjectId.isValid(entrega.userId)) return false;
  registro.info(deliveryAckLine(entrega, Date.now()));
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

/** Reparte un acuse (entregado o leído) a los del chat, por el socket. */
export async function repartirAcuse(chatId: string, frame: ReceiptFrame & { userId: string }): Promise<void> {
  // R31/10: with read receipts off in a 1:1, the other only learns «entregado».
  await broadcastReceipt(chatId, frame.userId, frame, (member, each) => emitirAcuse?.(member, each));
}

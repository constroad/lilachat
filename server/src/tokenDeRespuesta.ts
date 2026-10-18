import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { resolveJwtSecret } from './sessions.js';

/**
 * «Responder» y «Marcar como leído» desde el aviso (FL11, José 18/10: «no hay
 * botón responder directamente»), como WhatsApp, con la app CERRADA: el
 * teléfono no tiene el JWT a mano (vive cifrado en el llavero de la app). La
 * credencial es este token que trae el push: de esa persona y ese chat, firmado
 * con un secreto derivado para que no sirva como sesión, y con la misma vida
 * que el push en cola.
 */
const AUDIENCIA = 'respuesta-aviso';
const VIDA_DEL_TOKEN_S = 7 * 24 * 3600;
const secreto = () => `${resolveJwtSecret()}:${AUDIENCIA}`;

export function firmarRespuesta(params: { chatId: string; userId: string }): string {
  return jwt.sign({ c: params.chatId, u: params.userId }, secreto(), { audience: AUDIENCIA, expiresIn: VIDA_DEL_TOKEN_S });
}

export function verificarRespuesta(token: unknown): { chatId: string; userId: string } | null {
  if (typeof token !== 'string' || !token) return null;
  try {
    const claims = jwt.verify(token, secreto(), { audience: AUDIENCIA }) as { c?: unknown; u?: unknown };
    if (typeof claims.c !== 'string' || typeof claims.u !== 'string') return null;
    if (!Types.ObjectId.isValid(claims.c) || !Types.ObjectId.isValid(claims.u)) return null;
    return { chatId: claims.c, userId: claims.u };
  } catch {
    return null;
  }
}

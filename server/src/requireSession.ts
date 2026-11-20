import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { esDispositivoVinculado } from '@lilachat/shared';
import { verifySession } from './sessions.js';
import { vinculadoVigente } from './dispositivosVinculados.js';
import { isAccountClosed } from './closedAccounts.js';

/**
 * El guard de toda ruta que no sea el alta. La identidad sale del JWT firmado
 * — jamás de un header, del body ni de una query (`constroad-security` §0).
 */
declare module 'express-serve-static-core' {
  interface Request {
    session?: { userId: Types.ObjectId; deviceId: string; email: string };
  }
}

export const CLOSED_ACCOUNT_MESSAGE = 'Pediste borrar tu cuenta. Entra con tu código para recuperarla.';

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const header = String(req.headers.authorization ?? '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = token ? verifySession(token) : null;
  if (!claims || !Types.ObjectId.isValid(claims.userId)) {
    res.status(401).json({ message: 'Tu sesión venció. Vuelve a entrar.' });
    return;
  }
  // An account its owner asked to delete is closed at once, not when its JWT expires.
  if (isAccountClosed(claims.userId)) {
    res.status(401).json({ message: CLOSED_ACCOUNT_MESSAGE });
    return;
  }
  req.session = {
    userId: new Types.ObjectId(claims.userId),
    deviceId: claims.deviceId,
    email: claims.email,
  };
  if (!esDispositivoVinculado(claims.deviceId)) return next();
  // Una web vinculada que el teléfono cerró pierde el acceso YA, no en 24 h (W5).
  vinculadoVigente(claims.deviceId).then(
    (vigente) => (vigente ? next() : void res.status(401).json({ message: 'Esta sesión se cerró desde el teléfono.' })),
    next
  );
}

/**
 * Envuelve un handler `async` para que su rechazo llegue al manejador de
 * errores de Express en vez de quedar como promesa sin dueño — que es lo que
 * dejaba la petición sin respuesta y al cliente esperando para siempre.
 */
export const asyncRoute =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(handler: T) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res, next).catch(next);
  };

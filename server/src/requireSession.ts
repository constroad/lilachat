import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { verifySession } from './sessions.js';

/**
 * El guard de toda ruta que no sea el alta. La identidad sale del JWT firmado
 * — jamás de un header, del body ni de una query (`constroad-security` §0).
 */
declare module 'express-serve-static-core' {
  interface Request {
    session?: { userId: Types.ObjectId; deviceId: string; email: string };
  }
}

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const header = String(req.headers.authorization ?? '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = token ? verifySession(token) : null;
  if (!claims || !Types.ObjectId.isValid(claims.userId)) {
    res.status(401).json({ message: 'Tu sesión venció. Vuelve a entrar.' });
    return;
  }
  req.session = {
    userId: new Types.ObjectId(claims.userId),
    deviceId: claims.deviceId,
    email: claims.email,
  };
  next();
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

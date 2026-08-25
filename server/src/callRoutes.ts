import { Router } from 'express';
import { buildIceServers } from './turnCredentials.js';
import { requireSession } from './requireSession.js';

/**
 * Los servidores ICE que necesita WebRTC para conectar (F10).
 *
 * Se piden CON SESIÓN y se emiten por usuario: la credencial del TURN lleva el
 * `userId` adentro y vence en doce horas, así que un enlace filtrado no da un
 * relay eterno a cualquiera.
 */
export function buildCallRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/ice', (req, res) => {
    res.json({ iceServers: buildIceServers(String(req.session!.userId)) });
  });

  return router;
}

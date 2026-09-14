import { Router } from 'express';
import { obtenerIceServers } from './turnCredentials.js';
import { asyncRoute, requireSession } from './requireSession.js';

/**
 * Los servidores ICE que necesita WebRTC para conectar (F10).
 *
 * Se piden CON SESIÓN: las credenciales del TURN son cortas (las genera
 * Cloudflare por request) y solo se le dan a alguien logueado. El secreto del
 * TURN nunca sale del server.
 */
export function buildCallRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get(
    '/ice',
    asyncRoute(async (_req, res) => {
      res.json({ iceServers: await obtenerIceServers() });
    })
  );

  return router;
}

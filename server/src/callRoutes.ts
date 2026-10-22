import { Router } from 'express';
import { obtenerIceServers } from './turnCredentials.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { rechazarDesdeAviso } from './cicloDeLlamada.js';
import { callHistoryOf } from './callHistory.js';

/**
 * Los servidores ICE que necesita WebRTC para conectar (F10).
 *
 * Se piden CON SESIÓN: las credenciales del TURN son cortas (las genera
 * Cloudflare por request) y solo se le dan a alguien logueado. El secreto del
 * TURN nunca sale del server.
 */
export function buildCallRouter(): Router {
  const router = Router();

  /**
   * «Rechazar» desde la notificación con la app cerrada (FL8.1). SIN sesión a
   * propósito: el teléfono no tiene el JWT a mano. La credencial es el token
   * corto que trajo el push, que solo sirve para rechazar esa llamada.
   */
  router.post(
    '/rechazar',
    asyncRoute(async (req, res) => {
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      if (!(await rechazarDesdeAviso(token))) {
        res.status(400).json({ message: 'No se pudo rechazar la llamada.' });
        return;
      }
      res.status(204).end();
    })
  );

  router.use(requireSession);

  /** «Llamadas» in the web's rail (pending 38): my chats' call lines, newest first. */
  router.get(
    '/history',
    asyncRoute(async (req, res) => {
      res.json({ calls: await callHistoryOf(req.session!.userId) });
    })
  );

  router.get(
    '/ice',
    asyncRoute(async (_req, res) => {
      res.json({ iceServers: await obtenerIceServers() });
    })
  );

  return router;
}

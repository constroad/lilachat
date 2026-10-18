import { Router } from 'express';
import { DeviceModel } from './models.js';
import { parseWebSubscription } from './pushTargets.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { vapidPublicKey } from './webPushSender.js';
import { confirmarEntregaDesdeAviso } from './entregaPorAviso.js';
import { leidoDesdeAviso, responderDesdeAviso } from './respuestaDesdeAviso.js';

/**
 * Suscripción a Web Push (F6).
 *
 * La suscripción se ata al dispositivo **del JWT**, nunca a uno que venga en el
 * cuerpo: si el cliente eligiera a quién pertenece, cualquiera con sesión
 * podría desviarse las notificaciones de otro a su propio navegador.
 */
export function buildPushRouter(): Router {
  const router = Router();

  /**
   * La clave pública, sin sesión a propósito: no es un secreto —viaja en el
   * bundle de cualquier app web— y pedirla con JWT solo ataría el arranque del
   * service worker al orden del login.
   *
   * Sin configurar responde 503 y no una clave vacía: con una vacía el
   * navegador falla al suscribirse con un error críptico de criptografía, y el
   * motivo real (falta config en el server) no aparece por ningún lado.
   */
  router.get('/key', (_req, res) => {
    const key = vapidPublicKey();
    if (!key) {
      res.status(503).json({ message: 'Las notificaciones no están configuradas en el servidor.' });
      return;
    }
    res.json({ key });
  });

  /**
   * «Me llegó», desde el servicio de push del teléfono con la app cerrada
   * (FL8.2). SIN sesión a propósito: la credencial es el token corto que trajo
   * el push, que solo sirve para acusar ese mensaje.
   */
  router.post('/entregado', asyncRoute(async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!(await confirmarEntregaDesdeAviso(token))) {
      res.status(400).json({ message: 'No se pudo confirmar la entrega.' });
      return;
    }
    res.status(204).end();
  }));

  /**
   * «Responder» desde el aviso con la app cerrada (FL11). SIN sesión: la
   * credencial es el token del push, de esa persona y ese chat.
   */
  router.post('/responder', asyncRoute(async (req, res) => {
    const resultado = await responderDesdeAviso({ token: req.body?.token, texto: req.body?.texto, clientKey: req.body?.clientKey });
    if (resultado === 'enviada') return void res.status(201).json({ ok: true });
    if (resultado === 'prohibida') return void res.status(403).json({ message: 'Ya no eres parte de este chat.' });
    res.status(400).json({ message: 'No se pudo enviar la respuesta.' });
  }));

  /** «Marcar como leído» desde el aviso (FL11). */
  router.post('/leido', asyncRoute(async (req, res) => {
    if (!(await leidoDesdeAviso(req.body?.token))) return void res.status(400).json({ message: 'No se pudo marcar como leído.' });
    res.status(204).end();
  }));

  router.post('/subscribe', requireSession, asyncRoute(async (req, res) => {
    const raw = JSON.stringify(req.body?.subscription ?? null);
    // Se valida con el MISMO parser que usa el envío. Si acá pasara algo que
    // allá se descarta, el usuario quedaría «suscrito» sin recibir nada.
    if (!parseWebSubscription(raw)) {
      res.status(400).json({ message: 'Suscripción inválida.' });
      return;
    }

    await DeviceModel.updateOne(
      { deviceId: req.session!.deviceId },
      { $set: { pushToken: raw, platform: 'web', userId: req.session!.userId } },
      { upsert: true }
    );
    res.status(204).end();
  }));

  router.delete('/subscribe', requireSession, asyncRoute(async (req, res) => {
    await DeviceModel.updateOne(
      { deviceId: req.session!.deviceId },
      { $unset: { pushToken: 1 } }
    );
    res.status(204).end();
  }));

  return router;
}

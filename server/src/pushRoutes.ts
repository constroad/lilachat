import { Router } from 'express';
import { DeviceModel } from './models.js';
import { parseWebSubscription } from './pushTargets.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { vapidPublicKey } from './webPushSender.js';

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

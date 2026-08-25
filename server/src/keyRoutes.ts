import { Router } from 'express';
import { Types } from 'mongoose';
import { DeviceModel } from './models.js';
import { asyncRoute, requireSession } from './requireSession.js';

/**
 * El directorio de claves públicas (F9).
 *
 * El server acá es un **cartero**: guarda claves públicas y las reparte. No
 * puede leer nada con ellas, y esa impotencia es justamente la función.
 *
 * La clave se ata al dispositivo **del JWT**, nunca a uno que venga en el
 * cuerpo. Si el cliente pudiera elegir de quién es la clave que publica,
 * cualquiera con sesión pondría la suya en nombre de otro y desde ese momento
 * leería lo que le escriban a esa persona. Es EL ataque contra un directorio de
 * claves, y por eso el `deviceId` del body se ignora en silencio.
 */
const CLAVE_BYTES = 32;

/** Una X25519 son 32 bytes; en base64, 44 caracteres con relleno. */
function claveValida(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    return Buffer.from(value, 'base64').length === CLAVE_BYTES;
  } catch {
    return false;
  }
}

export function buildKeyRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.post(
    '/',
    asyncRoute(async (req, res) => {
      if (!claveValida(req.body?.publicKey)) {
        res.status(400).json({ message: 'Clave inválida.' });
        return;
      }
      await DeviceModel.updateOne(
        { deviceId: req.session!.deviceId },
        { $set: { publicKey: req.body.publicKey, userId: req.session!.userId } },
        { upsert: true }
      );
      res.status(204).end();
    })
  );

  router.get(
    '/:userId',
    asyncRoute(async (req, res) => {
      const userId = Types.ObjectId.isValid(String(req.params.userId))
        ? new Types.ObjectId(String(req.params.userId))
        : null;
      if (!userId) {
        res.json({ devices: [] });
        return;
      }

      // `select` explícito: acá NO puede colarse el `pushToken` ni nada más del
      // dispositivo. Una proyección abierta convertiría el directorio de claves
      // en una filtración de todo lo demás.
      const devices = await DeviceModel.find({ userId, publicKey: { $exists: true, $ne: '' } })
        .select('deviceId publicKey -_id')
        .lean();

      res.json({
        devices: devices.map((device) => ({
          deviceId: device.deviceId,
          publicKey: device.publicKey,
        })),
      });
    })
  );

  return router;
}

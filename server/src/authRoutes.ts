import { Router } from 'express';
import mongoose from 'mongoose';
import type { AuthClient } from './authClient.js';
import { normalizePeruPhone } from '@lilachat/shared';
import {
  GENERIC_OTP_RESPONSE,
  GENERIC_VERIFY_ERROR,
  decideOtpRequest,
  resolveOtpTarget,
  resolveVerifyTargets,
} from './invitationGate.js';
import { DeviceModel, InvitationModel, UserModel } from './models.js';
import { signSession } from './sessions.js';

/**
 * El alta (spec §5). El teléfono habla con ESTE server; este server habla con
 * constroad-auth. El gate corre ANTES de pedir el código y de nuevo al
 * canjearlo (defensa en profundidad).
 */
/**
 * **Registro abierto.** Lilachat es pública desde el 26/08/2026: cualquiera con
 * un celular puede entrar, sin que nadie lo invite antes.
 *
 * Es una constante y no una variable de entorno a propósito: cerrarlo otra vez
 * es una decisión de producto que merece un commit y un despliegue, no un
 * interruptor que alguien mueve de noche y nadie sabe por qué la familia dejó
 * de poder entrar.
 */
const REGISTRO_ABIERTO = true;

export function buildAuthRouter(authClient: AuthClient): Router {
  const router = Router();

  // Sin base no se cuelga: mongoose BUFFERIZA las queries hasta conectar y el
  // request queda mudo 10 segundos (visto en el humo de F1). Fallar diciéndolo.
  router.use((_req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Servicio arrancando. Inténtalo en un momento.' });
    }
    next();
  });

  /** La invitación (o el usuario ya existente) de ese teléfono, o `null`. */
  const findAdmission = async (phone: string) => {
    const [invitation, existingUser] = await Promise.all([
      InvitationModel.findOne({ phone, status: 'invited' }).lean(),
      UserModel.findOne({ phone }).lean(),
    ]);
    if (!invitation && !existingUser) return null;
    return { email: invitation?.email ?? existingUser?.email };
  };

  router.post('/otp/request', async (req, res) => {
    const phone = normalizePeruPhone(req.body?.phone);
    if (!phone) return res.status(400).json({ message: 'Escribe un celular válido.' });

    const admission = await findAdmission(phone);
    if (decideOtpRequest({ invited: Boolean(admission), registroAbierto: REGISTRO_ABIERTO }) === 'forward') {
      // UN solo destino. El respaldo NO es automático: si WhatsApp falla, el
      // usuario lo pide desde la pantalla del código. Mandarlo solo volvía
      // inútil ese botón —el correo llegaba sin pedirlo— y gastaba dos envíos.
      const target = resolveOtpTarget({
        phone,
        // Con el registro abierto puede no haber admisión: entonces no hay
        // correo de respaldo y el código sale por WhatsApp, que es el canal
        // que la persona acaba de escribir.
        email: admission?.email,
        preferEmail: req.body?.preferEmail === true,
      });
      const sent = await authClient.requestCode(target);
      if (!sent.ok) {
        console.error(
          `[auth] pedido de código falló por ${target.includes('@') ? 'email' : 'whatsapp'} (${sent.codigo})`
        );
      }
    }
    // La respuesta NO dice si hay respaldo. Se intentó devolver un
    // `emailFallback` para que la app supiera si ofrecer el botón, y el test
    // anti-enumeración lo tumbó en el acto: invitado y extraño recibían
    // cuerpos distintos, que es exactamente la fuga que este gate cierra.
    // La app ofrece SIEMPRE «enviar por correo»; si ese número no tiene
    // respaldo, el server no hace nada y la respuesta es la misma.
    return res.status(200).json(GENERIC_OTP_RESPONSE);
  });

  router.post('/otp/verify', async (req, res) => {
    const phone = normalizePeruPhone(req.body?.phone);
    const code = String(req.body?.code ?? '').trim();
    const deviceId = String(req.body?.deviceId ?? '').trim();
    if (!phone || !code || !deviceId) {
      return res.status(400).json({ message: 'Faltan datos.' });
    }
    const admission = await findAdmission(phone);
    // Con el registro abierto, no tener admisión NO es motivo de rechazo: lo
    // único que decide es si el código que llegó a ESE número es correcto, y eso
    // lo prueba constroad-auth. Cerrado, sigue siendo el mismo error que un
    // código malo, para no confirmar quién está en la lista.
    if (!admission && !REGISTRO_ABIERTO) {
      return res.status(401).json(GENERIC_VERIFY_ERROR);
    }

    // Al canjear sí se prueban los dos: el server no registra por dónde salió
    // cada código y ambos son legítimamente de esa persona. Es invisible y no
    // cambia lo que el usuario recibe — a diferencia del envío.
    const targets = resolveVerifyTargets({ phone, email: admission?.email });
    let verified = await authClient.verifyCode(targets[0]!, code, deviceId);
    for (const target of targets.slice(1)) {
      if (verified.ok) break;
      verified = await authClient.verifyCode(target, code, deviceId);
    }
    if (!verified.ok) {
      if (verified.codigo === 'sin_respuesta' || verified.codigo === 'sin_configurar') {
        return res.status(503).json({ message: 'No se pudo verificar. Inténtalo de nuevo.' });
      }
      return res.status(401).json(GENERIC_VERIFY_ERROR);
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const user = await UserModel.findOneAndUpdate(
      { phone },
      {
        $setOnInsert: { phone, ...(admission?.email ? { email: admission.email } : {}) },
        ...(name ? { $set: { name } } : {}),
      },
      { returnDocument: 'after', upsert: true }
    );
    await DeviceModel.findOneAndUpdate(
      { deviceId },
      { deviceId, userId: user._id, lastSeenAt: new Date() },
      { upsert: true }
    );

    return res.status(200).json({
      deviceSecret: verified.valor.secreto,
      jwt: signSession({ userId: String(user._id), deviceId, email: user.email ?? phone }),
      user: { id: String(user._id), name: user.name ?? null, phone },
    });
  });

  router.post('/session', async (req, res) => {
    const deviceId = String(req.body?.deviceId ?? '').trim();
    const deviceSecret = String(req.body?.deviceSecret ?? '').trim();
    if (!deviceId || !deviceSecret) return res.status(400).json({ message: 'Faltan datos.' });

    const validated = await authClient.validateDevice(deviceId, deviceSecret);
    if (!validated.ok) {
      // LA REGLA: la ausencia de respuesta NO revoca. Red caída = 503
      // reintentable; solo un rechazo REAL del servicio da 401.
      if (validated.codigo === 'sin_respuesta' || validated.codigo === 'sin_configurar') {
        return res.status(503).json({ message: 'No se pudo validar. Inténtalo de nuevo.' });
      }
      // Se DICE por qué: un 401 acá desloguea el teléfono, y sin esta línea el
      // síntoma es «se me cerró la sesión sola» sin nada que investigar.
      console.error(`[auth] sesión rechazada por el servicio (${validated.codigo}) device=${deviceId}`);
      return res.status(401).json({ message: 'Tu acceso ya no está activo.' });
    }

    // La identidad que devuelve el servicio puede ser el teléfono (canal
    // WhatsApp) o el correo (respaldo): se busca por las dos.
    const identity = String(validated.valor.identidad ?? '');
    const identityPhone = normalizePeruPhone(identity);
    const user = await UserModel.findOne(
      identityPhone ? { phone: identityPhone } : { email: identity.toLowerCase() }
    ).lean();
    if (!user) {
      console.error(
        `[auth] sesión válida pero SIN usuario local: identidad=${identity} device=${deviceId}`
      );
      return res.status(401).json({ message: 'Tu acceso ya no está activo.' });
    }

    void DeviceModel.updateOne({ deviceId }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
    // Se devuelve el USUARIO además del jwt: una credencial guardada por una
    // versión vieja de la app puede no tener `userId`, y sin él la pantalla no
    // distingue los mensajes propios de los ajenos (pasó de verdad). Así se
    // repara sola en el próximo arranque, sin obligar a re-loguear.
    return res.status(200).json({
      jwt: signSession({ userId: String(user._id), deviceId, email: user.email ?? user.phone }),
      user: { id: String(user._id), name: user.name ?? null, phone: user.phone },
    });
  });

  return router;
}

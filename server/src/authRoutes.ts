import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import type { AuthClient } from './authClient.js';
import { esDispositivoVinculado, normalizePeruPhone } from '@lilachat/shared';
import {
  GENERIC_OTP_RESPONSE,
  GENERIC_VERIFY_ERROR,
  backupEmailOf,
  decideOtpRequest,
  normalizeEmail,
  resolveOtpTarget,
  resolveVerifyTargets,
} from './invitationGate.js';
import { claimPhoneInvites } from './workspaces.js';
import { announceJoin } from './joinNotice.js';
import { accountOfEmail } from './emailAccounts.js';
import { DeviceModel, InvitationModel, UserModel, type User } from './models.js';
import { signSession } from './sessions.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { alertarServidor } from './alertaTelegram.js';
import { resolverUsuarioDeSesion } from './identidadDeSesion.js';
import { asyncRoute } from './requireSession.js';
import { cookieBorrada, cookieDeDispositivo, leerCookieDeDispositivo, pedidoSeguro } from './cookieDeDispositivo.js';
import { revocarVinculado, validarVinculado } from './dispositivosVinculados.js';
import { avisarCambioDeVinculos, desconectarDispositivo } from './socket.js';

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

/** The service did not refuse the code: it did not answer, and that is a retry. */
function refuseCode(res: Response, codigo: string) {
  if (codigo === 'sin_respuesta' || codigo === 'sin_configurar') {
    return res.status(503).json({ message: 'No se pudo verificar. Inténtalo de nuevo.' });
  }
  return res.status(401).json(GENERIC_VERIFY_ERROR);
}

/** How every sign-in ends: the device stays with its account and the session opens. */
async function openSession(req: Request, res: Response, user: User, deviceId: string, deviceSecret?: string) {
  await DeviceModel.findOneAndUpdate({ deviceId }, { deviceId, userId: user._id, lastSeenAt: new Date() }, { upsert: true });
  // The web (W0): the secret goes in an HttpOnly cookie, never in the body.
  const esWeb = req.body?.cliente === 'web';
  if (esWeb && deviceSecret) {
    res.setHeader('Set-Cookie', cookieDeDispositivo({ deviceId, deviceSecret, segura: pedidoSeguro(req) }));
  }
  return res.status(200).json({
    ...(esWeb ? {} : { deviceSecret }),
    jwt: signSession({ userId: String(user._id), deviceId, email: user.email ?? user.phone }),
    user: { id: String(user._id), name: user.name ?? null, phone: user.phone, avatarUrl: user.avatarUrl ? toAbsoluteMediaUrl(user.avatarUrl) : null },
  });
}


/** The jwt and the account of a renewed session; the profile photo rides here (FL9). */
const sessionBodyOf = (user: User, deviceId: string) => ({
  jwt: signSession({ userId: String(user._id), deviceId, email: user.email ?? user.phone }),
  user: { id: String(user._id), name: user.name ?? null, phone: user.phone, avatarUrl: user.avatarUrl ? toAbsoluteMediaUrl(user.avatarUrl) : null },
});

/** A web linked with the QR (W5): ours, constroad-auth does not know it. */
async function linkedSession(req: Request, res: Response, deviceId: string, deviceSecret: string) {
  const linked = await validarVinculado(deviceId, deviceSecret);
  const user = linked ? await UserModel.findById(linked.userId).lean() : null;
  if (!linked || !user) {
    res.setHeader('Set-Cookie', cookieBorrada(pedidoSeguro(req)));
    return res.status(401).json({ message: 'Esta sesión se cerró desde el teléfono.' });
  }
  void DeviceModel.updateOne({ deviceId }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
  res.setHeader('Set-Cookie', cookieDeDispositivo({ deviceId, deviceSecret, segura: pedidoSeguro(req), temporal: linked.temporal }));
  return res.status(200).json(sessionBodyOf(user, deviceId));
}

/** THE RULE: no answer does NOT revoke. A network down is a retryable 503; only a REAL refusal is a 401. */
function refusedSession(req: Request, res: Response, deviceId: string, code: string) {
  if (code === 'sin_respuesta' || code === 'sin_configurar') return res.status(503).json({ message: 'No se pudo validar. Inténtalo de nuevo.' });
  if (req.body?.cliente === 'web') res.setHeader('Set-Cookie', cookieBorrada(pedidoSeguro(req)));
  // It is SAID why: a 401 here signs the phone out, and without this line the symptom is «my session closed by itself».
  console.error(`[auth] sesión rechazada por el servicio (${code}) device=${deviceId}`);
  return res.status(401).json({ message: 'Tu acceso ya no está activo.' });
}

/**
 * **The owner comes from OUR record, not from the identity text.**
 *
 * This was the «my session closed by itself» bug (28/08/2026): the user was deduced again from the
 * `identidad` constroad-auth returns, which is the CHANNEL the code was redeemed through and not the
 * user's key. Whoever came in through the backup email had identity = that email, and if their user
 * did not have EXACTLY that email saved, nobody was found → 401 → the app deleted the credential.
 * The auth service still proves the device and its secret; the owner comes from `DeviceModel`,
 * written when the code is redeemed. The deduction is only for devices enrolled by an old version.
 */
async function sessionUserOf(identity: string, deviceId: string): Promise<{ user: User | null; via: string }> {
  const device = await DeviceModel.findOne({ deviceId }).select('userId').lean();
  const found = resolverUsuarioDeSesion({ userIdDelDevice: device?.userId ? String(device.userId) : null, identidad: identity });
  if (found.via === 'device') return { user: await UserModel.findById(found.userId).lean(), via: found.via };
  if (found.porTelefono) return { user: await UserModel.findOne({ phone: found.porTelefono }).lean(), via: found.via };
  if (found.porEmail) return { user: await UserModel.findOne({ email: found.porEmail }).lean(), via: found.via };
  return { user: null, via: found.via };
}

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
      InvitationModel.findOne({ phone, status: 'invited' }).select('_id').lean(),
      UserModel.findOne({ phone }).select('email emailVerifiedAt').lean(),
    ]);
    if (!invitation && !existingUser) return null;
    return { email: backupEmailOf(existingUser) };
  };

  router.post('/otp/request', asyncRoute(async (req, res) => {
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
        const canal = target.includes('@') ? 'email' : 'whatsapp';
        console.error(`[auth] pedido de código falló por ${canal} (${sent.codigo})`);
        // **El fallo SALE a buscarte** (pedido de José, 30/08/2026: «ni siquiera
        // llega el mensaje de error a Telegram»). Sin esto, que nadie pueda
        // entrar —auth sin base, WhatsApp caído, límite agotado— es invisible
        // hasta que alguien se queja. `sin_base`/`sin_respuesta` son infra
        // caída; `limitado` es el tope de envíos; cualquiera deja gente afuera.
        alertarServidor(
          `otp/request (${canal})`,
          new Error(`No se pudo enviar el código de acceso: ${sent.codigo}`)
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
  }));

  router.post('/otp/verify', asyncRoute(async (req, res) => {
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
    if (!verified.ok) return refuseCode(res, verified.codigo);

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const user = await UserModel.findOneAndUpdate(
      { phone },
      {
        // The email arrives later, proved by its owner in the profile (22/10): never the inviter's.
        $setOnInsert: { phone, joinPending: true },
        ...(name ? { $set: { name } } : {}),
      },
      { returnDocument: 'after', upsert: true }
    );
    // Who invited this phone hears «se unió a Lilachat» (only a new account with a name; `joinNotice.ts`).
    void announceJoin(user._id).catch((error) => console.error('[se-unio] no se pudo avisar:', error instanceof Error ? error.message : error));
    // Spaces that added this phone before it had an account (E1): it joins them now.
    await claimPhoneInvites(user._id, phone).catch((error) => console.error('[workspaces] no se pudieron reclamar invitaciones:', error instanceof Error ? error.message : error));
    return openSession(req, res, user, deviceId, verified.valor.secreto);
  }));

  /** Sign-in by email (spec INGRESO-POR-ESPACIO): same anti-enumeration answer as the phone. */
  router.post('/email/request', asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: 'Escribe un correo válido.' });
    const sent = await authClient.requestCode(email);
    if (!sent.ok) {
      console.error(`[auth] pedido de código falló por email (${sent.codigo})`);
      alertarServidor('email/request', new Error(`No se pudo enviar el código de acceso: ${sent.codigo}`));
    }
    return res.status(200).json(GENERIC_OTP_RESPONSE);
  }));

  router.post('/email/verify', asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code ?? '').trim();
    const deviceId = String(req.body?.deviceId ?? '').trim();
    if (!email || !code || !deviceId) return res.status(400).json({ message: 'Faltan datos.' });
    const verified = await authClient.verifyCode(email, code, deviceId);
    if (!verified.ok) return refuseCode(res, verified.codigo);
    return openSession(req, res, await accountOfEmail(email), deviceId, verified.valor.secreto);
  }));

  router.post('/session', asyncRoute(async (req, res) => {
    // La web (W0) renueva con la cookie; una sesión vieja suya todavía manda el
    // secreto en el cuerpo, y se muda a la cookie al renovar.
    const esWeb = req.body?.cliente === 'web';
    const deCookie = esWeb ? leerCookieDeDispositivo(req.headers.cookie) : null;
    const deviceId = String(req.body?.deviceId ?? deCookie?.deviceId ?? '').trim();
    const deviceSecret = String(req.body?.deviceSecret ?? deCookie?.deviceSecret ?? '').trim();
    if (!deviceId || !deviceSecret) {
      return esWeb ? res.status(401).json({ message: 'Tu acceso ya no está activo.' }) : res.status(400).json({ message: 'Faltan datos.' });
    }
    // Una web vinculada con el QR (W5) es nuestra: constroad-auth no la conoce.
    if (esDispositivoVinculado(deviceId)) return linkedSession(req, res, deviceId, deviceSecret);
    const validated = await authClient.validateDevice(deviceId, deviceSecret);
    if (!validated.ok) return refusedSession(req, res, deviceId, validated.codigo);
    const identity = String(validated.valor.identidad ?? '');
    const { user, via } = await sessionUserOf(identity, deviceId);
    if (!user) {
      console.error(`[auth] sesión válida pero SIN usuario local: via=${via} identidad=${identity} device=${deviceId}`);
      return res.status(401).json({ message: 'Tu acceso ya no está activo.' });
    }
    void DeviceModel.updateOne({ deviceId }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
    if (esWeb) res.setHeader('Set-Cookie', cookieDeDispositivo({ deviceId, deviceSecret, segura: pedidoSeguro(req) }));
    // Se devuelve el USUARIO además del jwt: una credencial guardada por una
    // versión vieja de la app puede no tener `userId`, y sin él la pantalla no
    // distingue los mensajes propios de los ajenos (pasó de verdad). Así se
    // repara sola en el próximo arranque, sin obligar a re-loguear.
    return res.status(200).json(sessionBodyOf(user, deviceId));
  }));

  /**
   * Cerrar sesión en la web (W0): la cookie se borra y ese navegador deja de
   * recibir avisos. Sin sesión a propósito: con el JWT vencido también se sale.
   */
  router.post('/salir', asyncRoute(async (req, res) => {
    const deCookie = leerCookieDeDispositivo(req.headers.cookie);
    if (deCookie && esDispositivoVinculado(deCookie.deviceId)) {
      // Una web vinculada que sale deja de estar vinculada (W5), con su secreto de prueba.
      const vinculado = await validarVinculado(deCookie.deviceId, deCookie.deviceSecret).catch(() => null);
      if (vinculado && (await revocarVinculado(vinculado.userId, deCookie.deviceId).catch(() => false))) {
        desconectarDispositivo(deCookie.deviceId);
        avisarCambioDeVinculos(String(vinculado.userId));
      }
    } else if (deCookie) await DeviceModel.updateOne({ deviceId: deCookie.deviceId }, { $unset: { pushToken: 1 } }).catch(() => undefined);
    res.setHeader('Set-Cookie', cookieBorrada(pedidoSeguro(req)));
    res.status(204).end();
  }));

  return router;
}

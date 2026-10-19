import { Router, type Request, type Response } from 'express';
import { esDispositivoVinculado, MAXIMO_DE_VINCULADOS, ROTAR_QR_CADA_MS } from '@lilachat/shared';
import { cookieDeDispositivo, pedidoSeguro } from './cookieDeDispositivo.js';
import { contarVinculados, crearDispositivoVinculado, listarVinculados, revocarVinculado } from './dispositivosVinculados.js';
import { crearLimiteDeIntentos } from './limiteDeIntentos.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { UserModel } from './models.js';
import { nombreDelNavegador } from './nombreDelNavegador.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { signSession } from './sessions.js';
import { avisarCambioDeVinculos, desconectarDispositivo } from './socket.js';
import { crearVinculaciones, type Vinculaciones } from './vinculaciones.js';

/**
 * Vincular la web con el QR del teléfono (W5, spec §54.4).
 *
 * Dos lados:
 * - la WEB, sin sesión (`/api/auth/vincular`): pide el QR, lo rota y espera;
 * - el TELÉFONO, con su sesión (`/api/vinculos`): consulta, aprueba, lista y
 *   cierra. Una web vinculada NO puede hacer nada de esto (403): si pudiera,
 *   quien robe una pestaña abierta vincularía otra computadora sin el teléfono.
 */
export type OpcionesDeVinculacion = { vinculaciones?: Vinculaciones; esperaMs?: number; limitePorMinuto?: number };

/** El long-poll de la web: corto para que un proxy no lo corte (los de Cloudflare cortan a los 100 s). */
const ESPERA_POR_DEFECTO_MS = 25_000;
const PEDIDOS_DE_QR_POR_MINUTO = 30;
const MINUTO_MS = 60_000;
const VENCIDA = { estado: 'vencida', message: 'El código venció. Genera otro.' };
const TOPE = `Ya tienes ${MAXIMO_DE_VINCULADOS} dispositivos vinculados. Cierra la sesión de uno para vincular otro.`;

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor : '');
/** La IP real: detrás del túnel `req.ip` es siempre la del túnel. */
const ipDe = (req: Request): string => texto(req.headers['cf-connecting-ip']) || req.ip || 'sin-ip';

export function buildVincularRouters(opciones: OpcionesDeVinculacion = {}) {
  const vinculaciones = opciones.vinculaciones ?? crearVinculaciones();
  const esperaMs = opciones.esperaMs ?? ESPERA_POR_DEFECTO_MS;
  const limite = crearLimiteDeIntentos({ maximo: opciones.limitePorMinuto ?? PEDIDOS_DE_QR_POR_MINUTO, ventanaMs: MINUTO_MS });
  return { web: routerDeLaWeb(vinculaciones, esperaMs, limite), telefono: routerDelTelefono(vinculaciones) };
}

function routerDeLaWeb(vinculaciones: Vinculaciones, esperaMs: number, limite: ReturnType<typeof crearLimiteDeIntentos>): Router {
  const router = Router();

  router.post('/iniciar', (req, res) => {
    if (!limite.permitir(ipDe(req))) return res.status(429).json({ message: 'Demasiados intentos. Espera un minuto.' });
    const inicio = vinculaciones.iniciar(nombreDelNavegador(req.headers['user-agent']));
    if (!inicio) return res.status(503).json({ message: 'No se pudo generar el código. Inténtalo en un momento.' });
    return res.status(200).json({ ...inicio, rotarCadaMs: ROTAR_QR_CADA_MS });
  });

  router.post('/rotar', (req, res) => {
    const rotado = vinculaciones.rotar(texto(req.body?.id), texto(req.body?.clave));
    return rotado ? res.status(200).json(rotado) : res.status(410).json(VENCIDA);
  });

  router.post(
    '/esperar',
    asyncRoute(async (req, res) => {
      const id = texto(req.body?.id);
      const clave = texto(req.body?.clave);
      // La web cerró la pestaña a mitad de la espera: no se canjea para nadie.
      // (`req.destroyed` no sirve: se pone en true apenas se termina de leer el cuerpo.)
      let seFue = false;
      res.on('close', () => (seFue = true));
      const estado = await vinculaciones.esperar(id, clave, esperaMs);
      if (seFue) return;
      if (estado === 'vencida') return res.status(410).json(VENCIDA);
      if (estado === 'pendiente') return res.status(200).json({ estado: 'pendiente' });
      return canjear(req, res, vinculaciones, { id, clave, mantener: req.body?.mantener !== false });
    })
  );

  return router;
}

/** La aprobación se vuelve dispositivo: cookie con el secreto + JWT, una sola vez. */
async function canjear(req: Request, res: Response, vinculaciones: Vinculaciones, params: { id: string; clave: string; mantener: boolean }) {
  const canje = vinculaciones.canjear(params.id, params.clave);
  if (!canje) return res.status(410).json(VENCIDA);
  const { userId, aprobadoPor } = canje.aprobacion;
  // Dos QR aprobados casi a la vez podían pasar el tope del «aprobar»: se mira de nuevo.
  if ((await contarVinculados(userId)) >= MAXIMO_DE_VINCULADOS) return res.status(409).json({ message: TOPE });
  const user = await UserModel.findById(userId).lean();
  if (!user) return res.status(410).json(VENCIDA);

  const temporal = !params.mantener;
  const { deviceId, secreto } = await crearDispositivoVinculado({ userId, aprobadoPor, nombre: canje.nombre, temporal });
  avisarCambioDeVinculos(userId);
  res.setHeader('Set-Cookie', cookieDeDispositivo({ deviceId, deviceSecret: secreto, segura: pedidoSeguro(req), temporal }));
  return res.status(200).json({
    estado: 'vinculada',
    jwt: signSession({ userId, deviceId, email: user.email ?? user.phone }),
    user: { id: userId, name: user.name ?? null, phone: user.phone, avatarUrl: user.avatarUrl ? toAbsoluteMediaUrl(user.avatarUrl) : null },
    deviceId,
  });
}

function routerDelTelefono(vinculaciones: Vinculaciones): Router {
  const router = Router();
  router.use(requireSession);
  router.use((req, res, next) => {
    if (esDispositivoVinculado(req.session!.deviceId)) {
      return res.status(403).json({ message: 'Los dispositivos se vinculan desde el teléfono.' });
    }
    next();
  });

  router.post('/consultar', (req, res) => {
    const consulta = vinculaciones.consultar(texto(req.body?.token));
    return consulta ? res.status(200).json(consulta) : res.status(410).json(VENCIDA);
  });

  router.post(
    '/aprobar',
    asyncRoute(async (req, res) => {
      const token = texto(req.body?.token);
      if (!vinculaciones.consultar(token)) return res.status(410).json(VENCIDA);
      const userId = String(req.session!.userId);
      if ((await contarVinculados(userId)) >= MAXIMO_DE_VINCULADOS) return res.status(409).json({ message: TOPE });
      const aprobado = vinculaciones.aprobar(token, { userId, aprobadoPor: req.session!.deviceId });
      return aprobado ? res.status(200).json(aprobado) : res.status(410).json(VENCIDA);
    })
  );

  router.get(
    '/',
    asyncRoute(async (req, res) => {
      res.status(200).json({ dispositivos: await listarVinculados(req.session!.userId) });
    })
  );

  router.delete(
    '/:deviceId',
    asyncRoute(async (req, res) => {
      const deviceId = texto(req.params.deviceId);
      if (!(await revocarVinculado(req.session!.userId, deviceId))) return res.status(404).json({ message: 'Ese dispositivo ya no está vinculado.' });
      desconectarDispositivo(deviceId);
      avisarCambioDeVinculos(String(req.session!.userId));
      return res.status(204).end();
    })
  );

  return router;
}

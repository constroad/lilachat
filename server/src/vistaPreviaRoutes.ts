import { Router } from 'express';
import type { VistaPreviaDeEnlace } from '@lilachat/shared';
import { asyncRoute, requireSession } from './requireSession.js';
import { urlPublica } from './vistaPrevia.js';

export type TraerVistaPrevia = (url: string) => Promise<VistaPreviaDeEnlace | null>;

/** Cuántas tarjetas se recuerdan: las más viejas salen primero. */
const MAX_EN_CACHE = 500;
const VIGENCIA_MS = 24 * 60 * 60_000;
/** Una página que no dio tarjeta se vuelve a probar en una hora, no en cada mensaje. */
const VIGENCIA_SIN_TARJETA_MS = 60 * 60_000;
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 60;

const cache = new Map<string, { vista: VistaPreviaDeEnlace | null; hasta: number }>();
const enCurso = new Map<string, Promise<VistaPreviaDeEnlace | null>>();
const pedidos = new Map<string, number[]>();

/** Para los tests y para no arrastrar estado entre corridas. */
export function resetVistasPrevias(): void {
  cache.clear();
  enCurso.clear();
  pedidos.clear();
}

function permitir(userId: string, ahora = Date.now()): boolean {
  const recientes = (pedidos.get(userId) ?? []).filter((at) => ahora - at < VENTANA_MS);
  const dentro = recientes.length < MAX_POR_VENTANA;
  if (dentro) recientes.push(ahora);
  pedidos.set(userId, recientes);
  return dentro;
}

function recordar(clave: string, vista: VistaPreviaDeEnlace | null): void {
  cache.delete(clave);
  cache.set(clave, { vista, hasta: Date.now() + (vista ? VIGENCIA_MS : VIGENCIA_SIN_TARJETA_MS) });
  if (cache.size > MAX_EN_CACHE) cache.delete(cache.keys().next().value!);
}

/** Una sola salida por enlace aunque lo pidan varios a la vez (todo el grupo abre el chat). */
async function buscar(clave: string, traer: TraerVistaPrevia): Promise<VistaPreviaDeEnlace | null> {
  const yaVa = enCurso.get(clave);
  if (yaVa) return yaVa;
  const viaje = traer(clave)
    .catch(() => null)
    .then((vista) => {
      recordar(clave, vista);
      return vista;
    })
    .finally(() => enCurso.delete(clave));
  enCurso.set(clave, viaje);
  return viaje;
}

/**
 * `GET /api/enlaces/vista-previa?url=` — la tarjeta de un enlace del chat
 * (José, 18/10: «como WhatsApp con el SEO»). Con sesión, con freno por usuario
 * y con caché: la página se visita una vez por día, no una por cada teléfono
 * que dibuja el mensaje. Los chats secretos no la piden: el server no tiene que
 * ver sus enlaces.
 */
export function buildVistaPreviaRouter(traer: TraerVistaPrevia): Router {
  const router = Router();
  router.use(requireSession);
  router.get(
    '/vista-previa',
    asyncRoute(async (req, res) => {
      const url = urlPublica(String(req.query.url ?? ''));
      if (!url) return res.status(400).json({ message: 'Ese enlace no tiene vista previa.' });
      const clave = url.toString();
      const guardada = cache.get(clave);
      if (guardada && guardada.hasta > Date.now()) return res.json({ vistaPrevia: guardada.vista });
      if (!permitir(String(req.session!.userId))) return res.status(429).json({ message: 'Demasiadas vistas previas. Prueba en un minuto.' });
      res.json({ vistaPrevia: await buscar(clave, traer) });
    })
  );
  return router;
}

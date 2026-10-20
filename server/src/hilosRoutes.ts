import { Router } from 'express';
import { hiloCompleto, resumenesDelChat } from './hilos.js';
import { toClientMessage, toClientMessages } from './messageView.js';
import { asyncRoute, requireSession } from './requireSession.js';

/**
 * Hilos (E3): el resumen de cada raíz del chat —el chip al día aunque el
 * teléfono estuviera desconectado— y un hilo entero al abrirlo.
 */
export function buildHilosRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get(
    '/:chatId/hilos',
    asyncRoute(async (req, res) => {
      const hilos = await resumenesDelChat(req.params.chatId!, req.session!.userId);
      return hilos ? res.json({ hilos }) : res.status(404).json({ message: 'Ese chat no existe.' });
    })
  );

  router.get(
    '/:chatId/hilos/:raiz',
    asyncRoute(async (req, res) => {
      const hilo = await hiloCompleto(req.params.chatId!, Number(req.params.raiz), req.session!.userId);
      if (!hilo) return res.status(404).json({ message: 'Ese hilo no existe.' });
      return res.json({ raiz: toClientMessage(hilo.raiz), respuestas: toClientMessages(hilo.respuestas) });
    })
  );

  return router;
}

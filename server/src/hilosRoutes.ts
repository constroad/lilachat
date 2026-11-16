import { Router } from 'express';
import { Types } from 'mongoose';
import { chatOfMember, hiloCompleto, resumenesDelChat } from './hilos.js';
import { toClientMessage, toClientMessages } from './messageView.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { markThreadRead } from './threadReads.js';

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
      // Opening a thread reads it (José 16/11): every device and the «Hilos» tab see it read.
      const lastSeq = hilo.respuestas.at(-1)?.seq;
      if (lastSeq) await markThreadRead(new Types.ObjectId(req.session!.userId), hilo.raiz.chatId, hilo.raiz.seq, lastSeq);
      return res.json({ raiz: toClientMessage(hilo.raiz), respuestas: toClientMessages(hilo.respuestas) });
    })
  );

  router.post(
    '/:chatId/hilos/:raiz/visto',
    asyncRoute(async (req, res) => {
      const seq = (req.body as { seq?: unknown } | undefined)?.seq;
      if (typeof seq !== 'number' || !Number.isInteger(seq) || seq <= 0) return res.status(400).json({ message: 'Falta hasta qué respuesta se vio.' });
      const chatId = await chatOfMember(req.params.chatId!, new Types.ObjectId(req.session!.userId));
      if (!chatId) return res.status(404).json({ message: 'Ese chat no existe.' });
      await markThreadRead(new Types.ObjectId(req.session!.userId), chatId, Number(req.params.raiz), seq);
      return res.status(204).end();
    })
  );

  return router;
}

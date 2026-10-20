import { Router } from 'express';
import { Types } from 'mongoose';
import { avisarEnElChat } from './chatRoutes.js';
import { desfijarMensaje, fijarMensaje } from './mensajesFijados.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { avisarCambioDeChat } from './socket.js';

/**
 * Fijar y desfijar mensajes (19/10). Al fijar queda la línea «X fijó un
 * mensaje» (no en un chat secreto) y todos releen el chat: los fijados viajan
 * con la lista de chats.
 */
export function buildFijadosRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.post(
    '/:chatId/fijados',
    asyncRoute(async (req, res) => {
      const quien = new Types.ObjectId(req.session!.userId);
      const r = await fijarMensaje({ chatId: req.params.chatId!, quien, seq: Number(req.body?.seq), duracion: String(req.body?.duracion ?? '') });
      if (!r.ok) return res.status(r.status).json({ message: r.motivo });
      for (const id of r.miembros) avisarCambioDeChat(id, req.params.chatId!);
      if (!r.encrypted) await avisarEnElChat({ chatId: req.params.chatId!, quien, evento: 'fijo', valor: String(req.body?.seq) });
      return res.status(200).json({ ok: true });
    })
  );

  router.delete(
    '/:chatId/fijados/:seq',
    asyncRoute(async (req, res) => {
      const r = await desfijarMensaje({ chatId: req.params.chatId!, quien: new Types.ObjectId(req.session!.userId), seq: Number(req.params.seq) });
      if (!r.ok) return res.status(r.status).json({ message: r.motivo });
      for (const id of r.miembros) avisarCambioDeChat(id, req.params.chatId!);
      return res.status(200).json({ ok: true });
    })
  );

  return router;
}

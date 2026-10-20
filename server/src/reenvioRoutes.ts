import { Router } from 'express';
import { reenviarMensaje } from './reenvio.js';
import { toClientMessage } from './messageView.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { publicarMensaje } from './socket.js';

/** `POST /api/chats/:chatId/reenviar` `{desde, seq, clientKey}`: la foto o el archivo, a este chat. */
export function buildReenvioRouter(): Router {
  const router = Router();
  router.use(requireSession);
  router.post(
    '/:chatId/reenviar',
    asyncRoute(async (req, res) => {
      const r = await reenviarMensaje({
        quien: req.session!.userId,
        desde: String(req.body?.desde ?? ''),
        seq: Number(req.body?.seq),
        hacia: req.params.chatId!,
        clientKey: String(req.body?.clientKey ?? ''),
      });
      if (!r.ok) return res.status(r.status).json({ message: r.motivo });
      if (!r.duplicate) await publicarMensaje(r.message, r.members);
      return res.status(r.duplicate ? 200 : 201).json({ message: toClientMessage(r.message), duplicate: r.duplicate });
    })
  );
  return router;
}

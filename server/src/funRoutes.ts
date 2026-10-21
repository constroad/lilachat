import { Router } from 'express';
import { Types } from 'mongoose';
import { asyncRoute, requireSession } from './requireSession.js';
import { avisarCambioDeChat } from './socket.js';
import { setGroupFun } from './zumbido.js';

/**
 * Nudges and winks in a group, on or off for everyone (José, 21/10): admins
 * only (`setGroupFun`). Its own module: `chatRoutes` was already over 600 lines.
 */
export function buildFunRouter(): Router {
  const router = Router();
  // Session per route, not `router.use`: mounted on a shared path, a global lock would close later public routes.
  router.patch('/chats/:chatId/fun', requireSession, asyncRoute(async (req, res) => {
    const allowed = req.body?.allowed === true;
    const outcome = await setGroupFun({ chatId: req.params.chatId!, who: new Types.ObjectId(req.session!.userId), allowed });
    if (!outcome.ok) return res.status(outcome.status).json({ message: outcome.reason });
    for (const id of outcome.members) avisarCambioDeChat(id, req.params.chatId!);
    return res.status(200).json({ ok: true, funAllowed: allowed });
  }));
  return router;
}

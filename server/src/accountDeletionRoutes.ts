import { Router, type Response } from 'express';
import { ACCOUNT_DELETION_TEXTS, confirmsAccountDeletion } from '@lilachat/shared';
import { asyncRoute, requireSession } from './requireSession.js';
import { AccountDeletionError, accountDeletionStatusOf, cancelAccountDeletion, requestAccountDeletion } from './accountDeletion.js';

/**
 * `/api/me/account-deletion` (José 19/11, Google Play): what the web, the APK
 * and the public page `/borrar-cuenta` call. Asking closes this very session.
 */
function answerFailure(res: Response, error: unknown) {
  if (error instanceof AccountDeletionError) return res.status(error.status).json({ message: error.message });
  throw error;
}

export function buildAccountDeletionRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', asyncRoute(async (req, res) => {
    try {
      return res.json(await accountDeletionStatusOf(req.session!.userId));
    } catch (error) {
      return answerFailure(res, error);
    }
  }));

  router.post('/', asyncRoute(async (req, res) => {
    if (!confirmsAccountDeletion(req.body?.confirm)) return res.status(400).json({ message: ACCOUNT_DELETION_TEXTS.confirmPrompt });
    try {
      return res.json(await requestAccountDeletion(req.session!.userId));
    } catch (error) {
      return answerFailure(res, error);
    }
  }));

  router.delete('/', asyncRoute(async (req, res) => {
    res.json({ cancelled: await cancelAccountDeletion(req.session!.userId) });
  }));

  return router;
}

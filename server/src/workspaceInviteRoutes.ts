import { Router } from 'express';
import type { AuthClient } from './authClient.js';
import { requireSession } from './requireSession.js';
import { inviteByEmail, revokeEmailInvite } from './workspaceEmailInvites.js';
import { handled, me } from './workspaceRoutes.js';

/**
 * Inviting to a space by email, mounted on `/api/workspaces` next to the rest
 * (José 12/11): apart, so the sender of the invitation email (constroad-auth)
 * comes in as a dependency and tests use their own.
 */
export function buildEmailInviteRouter(mailer: Pick<AuthClient, 'sendInvitation'>): Router {
  const router = Router();
  router.post('/:id/invites', requireSession, handled(async (req, res) => res.status(201).json(await inviteByEmail(req.params.id!, me(req), req.body ?? {}, (mail) => mailer.sendInvitation(mail)))));
  router.delete('/:id/invites/:inviteId', requireSession, handled(async (req, res) => {
    await revokeEmailInvite(req.params.id!, me(req), req.params.inviteId!);
    res.status(204).end();
  }));
  return router;
}

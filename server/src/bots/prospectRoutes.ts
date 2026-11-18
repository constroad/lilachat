import { Router, type Response } from 'express';
import { asyncRoute, requireSession } from '../requireSession.js';
import { daliKnowledge, latestReview, teachDali } from './daliDoor.js';
import { approveFollowUp, changeProspect, handBack, listProspects, oneProspect, prospectDocuments } from './prospectDesk.js';

/**
 * The doors of a Dali space for its members (BOTS-API «Fase 2: contrato»): the prospects, what a seller decides about
 * each one, and what Dali knows. Errors keep the API's shape `{ error, message }` (a 409 also brings the prospect).
 */
type Outcome = { status: number; error: string; message: string; prospect?: unknown } | Record<string, unknown>;

function send(res: Response, outcome: Outcome): void {
  if ('error' in outcome && typeof outcome.status === 'number') {
    const { status, ...body } = outcome;
    res.status(status).json(body);
    return;
  }
  res.json(outcome);
}

export function buildProspectRouter(): Router {
  const router = Router();
  const me = (req: { session?: { userId: import('mongoose').Types.ObjectId } }) => req.session!.userId;
  const prospectOf = (params: Record<string, string | undefined>) => String(params.prospectId ?? '');
  router.get('/workspaces/:id/prospects', requireSession, asyncRoute(async (req, res) => send(res, await listProspects(req.params.id!, me(req), req.query))));
  router.get('/workspaces/:id/prospects/by-chat/:chatId', requireSession, asyncRoute(async (req, res) => send(res, await oneProspect(req.params.id!, me(req), { chatId: String(req.params.chatId) }))));
  router.get('/workspaces/:id/prospects/:prospectId', requireSession, asyncRoute(async (req, res) => send(res, await oneProspect(req.params.id!, me(req), { prospectId: prospectOf(req.params) }))));
  router.get('/workspaces/:id/prospects/:prospectId/documents', requireSession, asyncRoute(async (req, res) => send(res, await prospectDocuments(req.params.id!, me(req), prospectOf(req.params)))));
  router.patch('/workspaces/:id/prospects/:prospectId', requireSession, asyncRoute(async (req, res) => send(res, await changeProspect(req.params.id!, prospectOf(req.params), me(req), req.body))));
  router.post('/workspaces/:id/prospects/:prospectId/follow-up', requireSession, asyncRoute(async (req, res) => send(res, await approveFollowUp(req.params.id!, prospectOf(req.params), me(req), req.body))));
  router.post('/workspaces/:id/prospects/:prospectId/handback', requireSession, asyncRoute(async (req, res) => send(res, await handBack(req.params.id!, prospectOf(req.params), me(req), req.body))));
  router.get('/workspaces/:id/dali/knowledge', requireSession, asyncRoute(async (req, res) => send(res, await daliKnowledge(req.params.id!, me(req)))));
  router.post('/workspaces/:id/dali/faqs', requireSession, asyncRoute(async (req, res) => send(res, await teachDali(req.params.id!, me(req), req.body))));
  router.get('/workspaces/:id/dali/review', requireSession, asyncRoute(async (req, res) => send(res, await latestReview(req.params.id!, me(req)))));
  return router;
}

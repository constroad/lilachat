import { Router } from 'express';
import { Types } from 'mongoose';
import { createReport } from './reports.js';
import { asyncRoute, requireSession } from './requireSession.js';

/**
 * «Denunciar» (Google Play, José 19/11): a person or someone else's message,
 * with a reason, an optional note and «Bloquear también». Mounted at
 * `/api/reports`; the queue lives in `/api/admin/reports`.
 */
export function buildReportRouter(): Router {
  const router = Router();
  router.use(requireSession);
  router.post('/', asyncRoute(async (req, res) => {
    const outcome = await createReport(new Types.ObjectId(req.session!.userId), req.body);
    if (!outcome.ok) return res.status(outcome.status).json({ message: outcome.reason });
    return res.status(outcome.status).json({ reportId: outcome.reportId, duplicate: outcome.duplicate, blocked: outcome.blocked });
  }));
  return router;
}

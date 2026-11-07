import { Router } from 'express';
import { WORK_MAP_FAILED, workMapOf, workMapRequest } from '@lilachat/shared';
import { asyncRoute, requireSession } from './requireSession.js';

/** A Portal cold start takes seconds; past this the tab offers to try again. */
const PORTAL_WAIT_MS = 7000;

export type PortalFetch = (url: string, init: RequestInit) => Promise<Response>;

/** The service detail out of Portal, or null: a cut body counts as no answer, like a 500. */
async function detailFrom(url: string, portalFetch: PortalFetch): Promise<{ detail?: unknown } | null> {
  try {
    const answer = await portalFetch(url, { signal: AbortSignal.timeout(PORTAL_WAIT_MS), headers: { accept: 'application/json' } });
    return answer.ok ? ((await answer.json()) as { detail?: unknown }) : null;
  } catch (failure) {
    // The URL carries the token of the link: only the kind of failure goes to the log.
    console.warn('work map: Portal did not answer', failure instanceof Error ? failure.name : 'unknown');
    return null;
  }
}

/**
 * «Mapa» of a service, drawn by Lilachat (José 06/11). Portal's public API has no CORS for the web,
 * so the server asks for it with the link the person already got. The token is the permission and
 * it travels in the body, out of any access log. Only Portal's address can be asked (`workMapRequest`).
 */
export function buildWorkMapRouter(portalFetch: PortalFetch = fetch): Router {
  const router = Router();
  router.use(requireSession);
  router.post('/', asyncRoute(async (req, res) => {
    const { link, serviceId } = (req.body ?? {}) as { link?: unknown; serviceId?: unknown };
    const url = typeof link === 'string' && typeof serviceId === 'string' ? workMapRequest(link, serviceId) : null;
    if (!url) return res.status(400).json({ message: WORK_MAP_FAILED });
    const answer = await detailFrom(url, portalFetch);
    if (!answer) return res.status(502).json({ message: WORK_MAP_FAILED });
    return res.json({ map: workMapOf(answer.detail) });
  }));
  return router;
}

import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { asyncRoute, requireSession } from './requireSession.js';
import { crearLimiteDeIntentos } from './limiteDeIntentos.js';
import {
  addByPhone,
  createWorkspace,
  joinByCode,
  leaveWorkspace,
  listMembers,
  myWorkspaces,
  previewByCode,
  updateMember,
  updateWorkspace,
  WorkspaceError,
} from './workspaces.js';
import { createChannel, joinChannel, listChannels } from './workspaceChannels.js';

/** Tries of a code per person and minute: enough to fix a typo, not to guess codes. */
const CODE_TRIES_PER_MINUTE = 10;
const ONE_MINUTE_MS = 60_000;

const me = (req: Request) => new Types.ObjectId(req.session!.userId);

/** A `WorkspaceError` becomes its status and message; anything else goes to Express. */
function handled(handler: (req: Request, res: Response) => Promise<unknown>) {
  return asyncRoute(async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof WorkspaceError) return void res.status(error.status).json({ message: error.message });
      next(error);
    }
  });
}

/** Company spaces (E1, spec §66), mounted on `/api/workspaces`. */
export function buildWorkspaceRouter(): Router {
  const router = Router();
  const codeTries = crearLimiteDeIntentos({ maximo: CODE_TRIES_PER_MINUTE, ventanaMs: ONE_MINUTE_MS });
  const limited = (req: Request, res: Response, next: NextFunction) =>
    codeTries.permitir(String(req.session!.userId)) ? next() : void res.status(429).json({ message: 'Demasiados intentos. Espera un minuto.' });
  router.use(requireSession);

  router.get('/', handled(async (req, res) => res.json({ workspaces: await myWorkspaces(me(req)) })));
  router.post('/', handled(async (req, res) => res.status(201).json({ workspace: await createWorkspace(me(req), req.body ?? {}) })));
  router.get('/preview/:code', limited, handled(async (req, res) => res.json(await previewByCode(req.params.code))));
  router.post('/join', limited, handled(async (req, res) => res.json(await joinByCode(me(req), req.body?.code))));
  router.patch('/:id', handled(async (req, res) => res.json({ workspace: await updateWorkspace(req.params.id!, me(req), req.body ?? {}) })));
  router.post('/:id/leave', handled(async (req, res) => {
    await leaveWorkspace(req.params.id!, me(req));
    res.status(204).end();
  }));
  router.get('/:id/members', handled(async (req, res) => res.json({ members: await listMembers(req.params.id!, me(req), req.query.status) })));
  router.post('/:id/members', handled(async (req, res) => res.status(201).json({ member: await addByPhone(req.params.id!, me(req), req.body ?? {}) })));
  router.patch('/:id/members/:memberId', handled(async (req, res) => res.json({ member: await updateMember(req.params.id!, me(req), req.params.memberId!, req.body ?? {}) })));
  router.get('/:id/channels', handled(async (req, res) => res.json({ channels: await listChannels(req.params.id!, me(req)) })));
  router.post('/:id/channels', handled(async (req, res) => res.status(201).json({ channel: await createChannel(req.params.id!, me(req), req.body ?? {}) })));
  router.post('/:id/channels/:chatId/join', handled(async (req, res) => res.json({ channel: await joinChannel(req.params.id!, me(req), req.params.chatId!) })));
  return router;
}

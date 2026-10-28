import { Router } from 'express';
import { Types } from 'mongoose';
import { validateScheduleInput } from '@lilachat/shared';
import { asyncRoute, requireSession } from '../requireSession.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { BotInstallationModel } from './botModels.js';
import { createSchedule, deleteSchedule, isSpaceAdminOf, schedulesOf, setScheduleActive } from './botSchedules.js';

const isId = (value: unknown): value is string => typeof value === 'string' && Types.ObjectId.isValid(value);
const installedApp = (spaceId: string, appId: unknown) => (isId(spaceId) && isId(appId) ? BotInstallationModel.findOne({ workspaceId: spaceId, appId, revokedAt: { $exists: false } }).lean() : null);
const NOT_INSTALLED = 'Esa app no está instalada en el espacio.';
const ONLY_ADMINS = 'Solo el dueño o un admin programa comandos.';

/**
 * «Horarios» of an app (design d-03; agentes COMANDOS-Y-HORARIOS §3): every
 * member of the space sees them, only an admin creates, pauses or deletes.
 */
export function buildScheduleRouter(): Router {
  const router = Router();
  router.get('/workspaces/:id/apps/:appId/schedules', requireSession, asyncRoute(async (req, res) => {
    const spaceId = req.params.id!;
    const member = isId(spaceId) ? await WorkspaceMemberModel.exists({ workspaceId: spaceId, userId: req.session!.userId, status: 'active' }) : null;
    const installation = member ? await installedApp(spaceId, req.params.appId) : null;
    if (!installation) return void res.status(404).json({ message: NOT_INSTALLED });
    res.json({ ...(await schedulesOf(installation)), canEdit: await isSpaceAdminOf(spaceId, req.session!.userId) });
  }));
  router.post('/workspaces/:id/apps/:appId/schedules', requireSession, asyncRoute(async (req, res) => {
    if (!(await isSpaceAdminOf(req.params.id!, req.session!.userId))) return void res.status(403).json({ message: ONLY_ADMINS });
    const installation = await installedApp(req.params.id!, req.params.appId);
    if (!installation) return void res.status(404).json({ message: NOT_INSTALLED });
    const valid = validateScheduleInput(req.body);
    if (!valid.ok) return void res.status(400).json({ message: valid.message });
    const created = await createSchedule(installation, req.session!.userId, valid.input);
    if ('status' in created) return void res.status(created.status).json({ message: created.message });
    res.status(201).json({ schedule: created });
  }));
  router.patch('/workspaces/:id/apps/:appId/schedules/:scheduleId', requireSession, asyncRoute(async (req, res) => {
    if (!(await isSpaceAdminOf(req.params.id!, req.session!.userId))) return void res.status(403).json({ message: ONLY_ADMINS });
    const installation = await installedApp(req.params.id!, req.params.appId);
    if (!installation) return void res.status(404).json({ message: NOT_INSTALLED });
    if (typeof req.body?.active !== 'boolean') return void res.status(400).json({ message: 'Manda { active: true | false }.' });
    const outcome = await setScheduleActive(installation, req.params.scheduleId!, req.body.active);
    if ('status' in outcome) return void res.status(outcome.status).json({ message: outcome.message });
    res.json(outcome);
  }));
  router.delete('/workspaces/:id/apps/:appId/schedules/:scheduleId', requireSession, asyncRoute(async (req, res) => {
    if (!(await isSpaceAdminOf(req.params.id!, req.session!.userId))) return void res.status(403).json({ message: ONLY_ADMINS });
    const installation = await installedApp(req.params.id!, req.params.appId);
    if (!installation) return void res.status(404).json({ message: NOT_INSTALLED });
    const outcome = await deleteSchedule(installation, req.params.scheduleId!);
    if ('status' in outcome) return void res.status(outcome.status).json({ message: outcome.message });
    res.json(outcome);
  }));
  return router;
}

import { Router } from 'express';
import { Types } from 'mongoose';
import { ADMIN_USERS_PAGE_SIZE, adminUsersQuery, type AdminUsersPage } from '@lilachat/shared';
import { PEOPLE, USER_FIELDS, adminUser, deviceCounts, invitersByPhone, peopleTotals, searchFilter, spaceCounts, type SourceUser } from './adminPeople.js';
import { adminReportsPage, closeReport } from './adminReports.js';
import { adminSpaceMembers, adminSpacesOverview } from './adminSpaces.js';
import { UserModel } from './models.js';
import { isSuperadmin } from './operators.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { incognitoWorkspaces } from './workspaces.js';

/**
 * The superadmin's panel (José, 21/10): who is in Lilachat, when they joined
 * and basic information. Never a chat, a message or a contact: the queries
 * read `users`, `devices`, `workspaces`, `workspacemembers` and `invitations` only.
 * The one exception is `/reports`: the copy of a message that someone chose to report.
 */
export function buildAdminRouter(): Router {
  const router = Router();
  router.use(requireSession);
  router.use(asyncRoute(async (req, res, next) => {
    if (await isSuperadmin(req.session!.userId)) return next();
    res.status(403).json({ message: 'Este panel es solo del superadmin.' });
  }));
  // The web asks this to decide whether Ajustes shows the panel.
  router.get('/', (_req, res) => void res.json({ superadmin: true }));
  // «Ver incógnitos» (José 13/11): the spaces where he is hidden, which the switcher does not list.
  router.get('/incognito', asyncRoute(async (req, res) => void res.json({ workspaces: await incognitoWorkspaces(new Types.ObjectId(req.session!.userId)) })));
  router.get('/users', asyncRoute(async (req, res) => {
    const { q, page } = adminUsersQuery(req.query);
    const filter = { ...PEOPLE, ...searchFilter(q) };
    const [users, total, totals] = await Promise.all([
      UserModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * ADMIN_USERS_PAGE_SIZE).limit(ADMIN_USERS_PAGE_SIZE).select(USER_FIELDS).lean<SourceUser[]>(),
      UserModel.countDocuments(filter),
      peopleTotals(Date.now()),
    ]);
    const ids = users.map((user) => user._id);
    const [devicesOf, spacesOf, inviters] = await Promise.all([deviceCounts(ids), spaceCounts(ids), invitersByPhone(users.map((user) => user.phone))]);
    const body: AdminUsersPage = {
      users: users.map((user) => adminUser(user, { devices: devicesOf(user._id), spaces: spacesOf(user._id), invitedBy: inviters.get(user.phone) ?? null })),
      total,
      page,
      pageSize: ADMIN_USERS_PAGE_SIZE,
      totals,
    };
    res.json(body);
  }));
  // Grouped by space (José 14/11, design `adm-01-usuarios-por-espacio`).
  router.get('/spaces', asyncRoute(async (req, res) => void res.json(await adminSpacesOverview(adminUsersQuery(req.query), Date.now()))));
  router.get('/spaces/:spaceId/members', asyncRoute(async (req, res) => {
    const body = await adminSpaceMembers(String(req.params.spaceId), adminUsersQuery(req.query), Date.now());
    if (!body) return void res.status(404).json({ message: 'Ese espacio no existe o fue eliminado.' });
    res.json(body);
  }));
  // Reports (Google Play, José 19/11): the queue, urgent first, and closing one.
  router.get('/reports', asyncRoute(async (req, res) => void res.json(await adminReportsPage(req.query))));
  router.post('/reports/:reportId/close', asyncRoute(async (req, res) => {
    const outcome = await closeReport(new Types.ObjectId(req.session!.userId), String(req.params.reportId), req.body ?? {});
    if (!outcome.ok) return void res.status(outcome.status).json({ message: outcome.reason });
    res.json({ ok: true });
  }));
  return router;
}

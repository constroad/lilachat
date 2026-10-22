import { Router } from 'express';
import { Types } from 'mongoose';
import { ADMIN_USERS_PAGE_SIZE, TELEFONO_DE_LILA, adminUsersQuery, escaparRegex, type AdminUser, type AdminUsersPage, type AdminUsersTotals } from '@lilachat/shared';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { DeviceModel, InvitationModel, UserModel, type User } from './models.js';
import { isSuperadmin } from './operators.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { WorkspaceMemberModel } from './workspaceModels.js';

/**
 * The superadmin's panel (José, 21/10): who is in Lilachat, when they joined
 * and basic information. Never a chat, a message or a contact: the queries
 * below read `users`, `devices`, `workspacemembers` and `invitations` only.
 */
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MIN_PHONE_DIGITS = 3;
/** People only: an installed app (a bot) and the built-in Lila are users too, but not people. */
const PEOPLE = { app: { $exists: false }, phone: { $ne: TELEFONO_DE_LILA } };
const USER_FIELDS = 'name phone avatarUrl email emailVerifiedAt birthday createdAt lastSeenAt';

type SourceUser = Pick<User, 'name' | 'phone' | 'avatarUrl' | 'email' | 'emailVerifiedAt' | 'birthday' | 'lastSeenAt'> & { _id: Types.ObjectId; createdAt: Date };
type CountRow = { _id: Types.ObjectId; count: number };
type DeviceRow = { _id: { userId: Types.ObjectId; platform: 'android' | 'web' }; count: number };

/** By name, email or a piece of the phone, escaped: a search is text, never a regex someone wrote. */
function searchFilter(q: string): Record<string, unknown> {
  if (!q) return {};
  const pattern = new RegExp(escaparRegex(q), 'i');
  const digits = q.replace(/\D/g, '');
  const byPhone = digits.length >= MIN_PHONE_DIGITS ? [{ phone: { $regex: escaparRegex(digits) } }] : [];
  return { $or: [{ name: pattern }, { email: pattern }, ...byPhone] };
}

async function peopleTotals(now: number): Promise<AdminUsersTotals> {
  const [people, newThisWeek, activeToday, profileComplete] = await Promise.all([
    UserModel.countDocuments(PEOPLE),
    UserModel.countDocuments({ ...PEOPLE, createdAt: { $gte: new Date(now - WEEK_MS) } }),
    UserModel.countDocuments({ ...PEOPLE, lastSeenAt: { $gte: new Date(now - DAY_MS) } }),
    UserModel.countDocuments({ ...PEOPLE, name: { $nin: [null, ''] }, 'birthday.month': { $exists: true }, email: { $exists: true }, emailVerifiedAt: { $exists: true } }),
  ]);
  return { people, newThisWeek, activeToday, profileComplete };
}

/** Who invited each phone, by name (or phone): `invitedBy` keeps the inviter's user id. */
async function invitersByPhone(phones: string[]): Promise<Map<string, string>> {
  const invitations = await InvitationModel.find({ phone: { $in: phones } }).select('phone invitedBy').lean();
  const ids = invitations.map((invitation) => invitation.invitedBy).filter((id) => Types.ObjectId.isValid(id));
  const inviters = await UserModel.find({ _id: { $in: ids } }).select('name phone').lean();
  const names = new Map(inviters.map((inviter) => [String(inviter._id), inviter.name || inviter.phone]));
  return new Map(invitations.flatMap((invitation) => (names.has(invitation.invitedBy) ? [[invitation.phone, names.get(invitation.invitedBy)!] as const] : [])));
}

/** Devices by platform and active spaces, for one page of people: two aggregates over that page. */
async function pageCounts(ids: Types.ObjectId[]) {
  const [devices, spaces] = await Promise.all([
    DeviceModel.aggregate<DeviceRow>([{ $match: { userId: { $in: ids } } }, { $group: { _id: { userId: '$userId', platform: '$platform' }, count: { $sum: 1 } } }]),
    WorkspaceMemberModel.aggregate<CountRow>([{ $match: { userId: { $in: ids }, status: 'active' } }, { $group: { _id: '$userId', count: { $sum: 1 } } }]),
  ]);
  const devicesOf = (id: Types.ObjectId): AdminUser['devices'] => {
    const count = (platform: 'android' | 'web') => devices.find((row) => row._id.userId.equals(id) && row._id.platform === platform)?.count ?? 0;
    return { android: count('android'), web: count('web') };
  };
  const spacesOf = (id: Types.ObjectId) => spaces.find((row) => row._id.equals(id))?.count ?? 0;
  return { devicesOf, spacesOf };
}

function adminUser(user: SourceUser, extra: Pick<AdminUser, 'devices' | 'spaces' | 'invitedBy'>): AdminUser {
  const emailVerified = Boolean(user.email && user.emailVerifiedAt);
  return {
    id: String(user._id),
    name: user.name ?? null,
    phone: user.phone,
    avatarUrl: user.avatarUrl ? toAbsoluteMediaUrl(user.avatarUrl) : null,
    email: user.email ?? null,
    emailVerified,
    profileComplete: Boolean(user.name && user.birthday?.month && emailVerified),
    joinedAt: user.createdAt.toISOString(),
    lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
    ...extra,
  };
}

export function buildAdminRouter(): Router {
  const router = Router();
  router.use(requireSession);
  router.use(asyncRoute(async (req, res, next) => {
    if (await isSuperadmin(req.session!.userId)) return next();
    res.status(403).json({ message: 'Este panel es solo del superadmin.' });
  }));
  // The web asks this to decide whether Ajustes shows the panel.
  router.get('/', (_req, res) => void res.json({ superadmin: true }));
  router.get('/users', asyncRoute(async (req, res) => {
    const { q, page } = adminUsersQuery(req.query);
    const filter = { ...PEOPLE, ...searchFilter(q) };
    const [users, total, totals] = await Promise.all([
      UserModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * ADMIN_USERS_PAGE_SIZE).limit(ADMIN_USERS_PAGE_SIZE).select(USER_FIELDS).lean<SourceUser[]>(),
      UserModel.countDocuments(filter),
      peopleTotals(Date.now()),
    ]);
    const [counts, inviters] = await Promise.all([pageCounts(users.map((user) => user._id)), invitersByPhone(users.map((user) => user.phone))]);
    const body: AdminUsersPage = {
      users: users.map((user) => adminUser(user, { devices: counts.devicesOf(user._id), spaces: counts.spacesOf(user._id), invitedBy: inviters.get(user.phone) ?? null })),
      total,
      page,
      pageSize: ADMIN_USERS_PAGE_SIZE,
      totals,
    };
    res.json(body);
  }));
  return router;
}

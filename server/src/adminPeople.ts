import { Types } from 'mongoose';
import { TELEFONO_DE_LILA, escaparRegex, type AdminUser, type AdminUsersTotals } from '@lilachat/shared';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { DeviceModel, InvitationModel, UserModel, type User } from './models.js';
import { WorkspaceMemberModel } from './workspaceModels.js';

/**
 * What both views of the superadmin's panel share (flat list, `adminRoutes.ts`;
 * grouped by space, `adminSpaces.ts`): who is a person, the search, the totals
 * and a person's basic information. Never a chat, a message or a contact.
 */
export const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MIN_PHONE_DIGITS = 3;
/** People only: an installed app (a bot) and the built-in Lila are users too, but not people. */
export const PEOPLE = { app: { $exists: false }, phone: { $ne: TELEFONO_DE_LILA } };
export const USER_FIELDS = 'name phone avatarUrl email emailVerifiedAt birthday createdAt lastSeenAt';

export type SourceUser = Pick<User, 'name' | 'phone' | 'avatarUrl' | 'email' | 'emailVerifiedAt' | 'birthday' | 'lastSeenAt'> & { _id: Types.ObjectId; createdAt: Date };
type CountRow = { _id: Types.ObjectId; count: number };
type DeviceRow = { _id: { userId: Types.ObjectId; platform: 'android' | 'web' }; count: number };

/** By name, email or a piece of the phone, escaped: a search is text, never a regex someone wrote. */
export function searchFilter(q: string): Record<string, unknown> {
  if (!q) return {};
  const pattern = new RegExp(escaparRegex(q), 'i');
  const digits = q.replace(/\D/g, '');
  const byPhone = digits.length >= MIN_PHONE_DIGITS ? [{ phone: { $regex: escaparRegex(digits) } }] : [];
  return { $or: [{ name: pattern }, { email: pattern }, ...byPhone] };
}

export async function peopleTotals(now: number): Promise<AdminUsersTotals> {
  const [people, newThisWeek, activeToday, profileComplete] = await Promise.all([
    UserModel.countDocuments(PEOPLE),
    UserModel.countDocuments({ ...PEOPLE, createdAt: { $gte: new Date(now - WEEK_MS) } }),
    UserModel.countDocuments({ ...PEOPLE, lastSeenAt: { $gte: new Date(now - DAY_MS) } }),
    UserModel.countDocuments({ ...PEOPLE, name: { $nin: [null, ''] }, 'birthday.month': { $exists: true } }),
  ]);
  return { people, newThisWeek, activeToday, profileComplete };
}

/** Who invited each phone, by name (or phone): `invitedBy` keeps the inviter's user id. */
export async function invitersByPhone(phones: string[]): Promise<Map<string, string>> {
  const invitations = await InvitationModel.find({ phone: { $in: phones } }).select('phone invitedBy').lean();
  const ids = invitations.map((invitation) => invitation.invitedBy).filter((id) => Types.ObjectId.isValid(id));
  const inviters = await UserModel.find({ _id: { $in: ids } }).select('name phone').lean();
  const names = new Map(inviters.map((inviter) => [String(inviter._id), inviter.name || inviter.phone]));
  return new Map(invitations.flatMap((invitation) => (names.has(invitation.invitedBy) ? [[invitation.phone, names.get(invitation.invitedBy)!] as const] : [])));
}

/** Devices by platform, for one page of people: one aggregate over that page. */
export async function deviceCounts(ids: Types.ObjectId[]): Promise<(id: Types.ObjectId) => AdminUser['devices']> {
  const devices = await DeviceModel.aggregate<DeviceRow>([{ $match: { userId: { $in: ids } } }, { $group: { _id: { userId: '$userId', platform: '$platform' }, count: { $sum: 1 } } }]);
  return (id) => {
    const count = (platform: 'android' | 'web') => devices.find((row) => row._id.userId.equals(id) && row._id.platform === platform)?.count ?? 0;
    return { android: count('android'), web: count('web') };
  };
}

/** Active spaces of each person of one page: one aggregate. */
export async function spaceCounts(ids: Types.ObjectId[]): Promise<(id: Types.ObjectId) => number> {
  const spaces = await WorkspaceMemberModel.aggregate<CountRow>([{ $match: { userId: { $in: ids }, status: 'active' } }, { $group: { _id: '$userId', count: { $sum: 1 } } }]);
  return (id) => spaces.find((row) => row._id.equals(id))?.count ?? 0;
}

export function adminUser(user: SourceUser, extra: Pick<AdminUser, 'devices' | 'spaces' | 'invitedBy'>): AdminUser {
  const emailVerified = Boolean(user.email && user.emailVerifiedAt);
  return {
    id: String(user._id),
    name: user.name ?? null,
    phone: user.phone,
    avatarUrl: user.avatarUrl ? toAbsoluteMediaUrl(user.avatarUrl) : null,
    email: user.email ?? null,
    emailVerified,
    profileComplete: Boolean(user.name && user.birthday?.month),
    joinedAt: user.createdAt.toISOString(),
    lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
    ...extra,
  };
}

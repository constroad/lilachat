import { Types, type PipelineStage } from 'mongoose';
import {
  ADMIN_NO_SPACE,
  ADMIN_ROLE_ORDER,
  ADMIN_SPACES_PAGE_SIZE,
  ADMIN_SPACE_PREVIEW,
  ADMIN_USERS_PAGE_SIZE,
  type AdminSpaceMember,
  type AdminSpaceMembersPage,
  type AdminSpaceRef,
  type AdminSpaceSummary,
  type AdminSpacesOverview,
  type WorkspaceRole,
} from '@lilachat/shared';
import { DAY_MS, PEOPLE, USER_FIELDS, adminUser, deviceCounts, invitersByPhone, peopleTotals, searchFilter, type SourceUser } from './adminPeople.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { UserModel } from './models.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';

/**
 * The superadmin's panel grouped by space (José 14/11, design
 * `adm-01-usuarios-por-espacio`). Active members of live spaces, people only
 * (no bots, no Lila). A member hidden in a space (incognito) is listed too,
 * marked: the superadmin sees everyone. Every list is a handful of aggregates
 * over the page, never a query per space or per person.
 */
type Query = { q: string; page: number };
type People = Record<string, unknown>;
type LiveSpace = { _id: Types.ObjectId; name: string; logoUrl?: string };
type MemberRow = { userId: Types.ObjectId; role: WorkspaceRole | null; hidden: boolean };
type SpaceCount = { _id: Types.ObjectId; members: number; activeToday: number };
type PageFacet<Row> = { rows: Row[]; total: { n: number }[] };
type ToMember = (row: MemberRow, ownSpace: string | null) => AdminSpaceMember | null;

const ACTIVE = 'active';
const BY_ROLE: PipelineStage[] = [{ $addFields: { rank: { $indexOfArray: [[...ADMIN_ROLE_ORDER], '$role'] } } }, { $sort: { rank: 1, _id: 1 } }];
const MEMBER_FIELDS = { _id: 0, userId: 1, role: 1, hidden: { $eq: ['$hidden', true] } };

const liveSpaces = () => WorkspaceModel.find({ deletedAt: { $exists: false } }).select('name logoUrl').lean<LiveSpace[]>();

/** Keeps the memberships of people matching the search, with when the person was last seen. */
function personStages(people: People): PipelineStage[] {
  const lookup = { from: UserModel.collection.name, localField: 'userId', foreignField: '_id', as: 'person', pipeline: [{ $match: people }, { $project: { lastSeenAt: 1 } }] };
  return [{ $lookup: lookup }, { $unwind: '$person' }];
}

/** Members and active-today members of each space: one aggregate for all of them. */
function countsBySpace(spaceIds: Types.ObjectId[], people: People, now: number): Promise<SpaceCount[]> {
  const today = { $cond: [{ $gte: ['$person.lastSeenAt', new Date(now - DAY_MS)] }, 1, 0] };
  return WorkspaceMemberModel.aggregate<SpaceCount>([
    { $match: { workspaceId: { $in: spaceIds }, status: ACTIVE } },
    ...personStages(people),
    { $group: { _id: '$workspaceId', members: { $sum: 1 }, activeToday: { $sum: today } } },
  ]);
}

/** The spaces with someone in them, the biggest first. */
function summaries(live: LiveSpace[], counts: SpaceCount[]): AdminSpaceSummary[] {
  const byId = new Map(live.map((space) => [String(space._id), space]));
  return counts
    .flatMap((count) => {
      const space = byId.get(String(count._id));
      return space ? [{ id: String(space._id), name: space.name, logoUrl: space.logoUrl ? toAbsoluteMediaUrl(space.logoUrl) : null, members: count.members, activeToday: count.activeToday }] : [];
    })
    .sort((a, b) => b.members - a.members || a.name.localeCompare(b.name, 'es'));
}

/** The first members of each space of the page, by role. */
function previewRows(spaceIds: Types.ObjectId[], people: People) {
  return WorkspaceMemberModel.aggregate<{ _id: Types.ObjectId; rows: MemberRow[] }>([
    { $match: { workspaceId: { $in: spaceIds }, status: ACTIVE } },
    ...personStages(people),
    ...BY_ROLE,
    { $group: { _id: '$workspaceId', rows: { $push: { userId: '$userId', role: '$role', hidden: MEMBER_FIELDS.hidden } } } },
    { $project: { rows: { $slice: ['$rows', ADMIN_SPACE_PREVIEW] } } },
  ]);
}

const pageStage = (skip: number, limit: number, fields: Record<string, unknown>): PipelineStage => ({ $facet: { rows: [{ $skip: skip }, { $limit: limit }, { $project: fields }], total: [{ $count: 'n' }] } });

/** One page of a space's members, by role, and how many match. */
async function spaceRows(spaceId: Types.ObjectId, people: People, page: number): Promise<{ rows: MemberRow[]; total: number }> {
  const [facet] = await WorkspaceMemberModel.aggregate<PageFacet<MemberRow>>([
    { $match: { workspaceId: spaceId, status: ACTIVE } },
    ...personStages(people),
    ...BY_ROLE,
    pageStage((page - 1) * ADMIN_USERS_PAGE_SIZE, ADMIN_USERS_PAGE_SIZE, MEMBER_FIELDS),
  ]);
  return { rows: facet?.rows ?? [], total: facet?.total[0]?.n ?? 0 };
}

/** People matching the search who are in no live space, newest first. */
async function noSpaceRows(liveIds: Types.ObjectId[], people: People, skip: number, limit: number): Promise<{ rows: MemberRow[]; total: number }> {
  const memberships = { from: WorkspaceMemberModel.collection.name, localField: '_id', foreignField: 'userId', as: 'spaces', pipeline: [{ $match: { status: ACTIVE, workspaceId: { $in: liveIds } } }, { $limit: 1 }, { $project: { _id: 1 } }] };
  const [facet] = await UserModel.aggregate<PageFacet<{ _id: Types.ObjectId }>>([
    { $match: people },
    { $lookup: memberships },
    { $match: { spaces: { $size: 0 } } },
    { $sort: { createdAt: -1, _id: -1 } },
    pageStage(skip, limit, { _id: 1 }),
  ]);
  return { rows: (facet?.rows ?? []).map((row) => ({ userId: row._id, role: null, hidden: false })), total: facet?.total[0]?.n ?? 0 };
}

/** The live spaces of each person, by name: «También en» and how many spaces. */
async function liveSpacesOf(userIds: Types.ObjectId[], live: LiveSpace[]): Promise<Map<string, AdminSpaceRef[]>> {
  const names = new Map(live.map((space) => [String(space._id), space.name]));
  const rows = await WorkspaceMemberModel.find({ userId: { $in: userIds }, status: ACTIVE }).select('userId workspaceId').lean();
  const byUser = new Map<string, AdminSpaceRef[]>();
  for (const row of rows) {
    const name = names.get(String(row.workspaceId));
    if (name) byUser.set(String(row.userId), [...(byUser.get(String(row.userId)) ?? []), { id: String(row.workspaceId), name }]);
  }
  return byUser;
}

/** Everything a member row shows, for all the rows of a response in four queries. */
async function memberBuilder(rows: MemberRow[], live: LiveSpace[]): Promise<ToMember> {
  const ids = [...new Map(rows.map((row) => [String(row.userId), row.userId])).values()];
  const [users, devicesOf, spacesOf] = await Promise.all([
    UserModel.find({ _id: { $in: ids } }).select(USER_FIELDS).lean<SourceUser[]>(),
    deviceCounts(ids),
    liveSpacesOf(ids, live),
  ]);
  const inviters = await invitersByPhone(users.map((user) => user.phone));
  const byId = new Map(users.map((user) => [String(user._id), user]));
  return (row, ownSpace) => {
    const user = byId.get(String(row.userId));
    if (!user) return null;
    const spaces = (spacesOf.get(String(user._id)) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const base = adminUser(user, { devices: devicesOf(user._id), spaces: spaces.length, invitedBy: inviters.get(user.phone) ?? null });
    return { ...base, role: row.role, hidden: row.hidden, alsoIn: spaces.filter((space) => space.id !== ownSpace) };
  };
}

const membersOf = (rows: MemberRow[], toMember: ToMember, ownSpace: string | null): AdminSpaceMember[] => rows.flatMap((row) => toMember(row, ownSpace) ?? []);

/** `GET /admin/spaces`: the filter column, one page of groups with their first members, and «Sin espacio». */
export async function adminSpacesOverview(query: Query, now: number): Promise<AdminSpacesOverview> {
  const people = { ...PEOPLE, ...searchFilter(query.q) };
  const live = await liveSpaces();
  const liveIds = live.map((space) => space._id);
  const [counts, totals, peopleCount, noSpace] = await Promise.all([countsBySpace(liveIds, people, now), peopleTotals(now), UserModel.countDocuments(people), noSpaceRows(liveIds, people, 0, ADMIN_SPACE_PREVIEW)]);
  const spaces = summaries(live, counts);
  const pageSpaces = spaces.slice((query.page - 1) * ADMIN_SPACES_PAGE_SIZE, query.page * ADMIN_SPACES_PAGE_SIZE);
  const previews = await previewRows(pageSpaces.map((space) => new Types.ObjectId(space.id)), people);
  const toMember = await memberBuilder([...previews.flatMap((preview) => preview.rows), ...noSpace.rows], live);
  const rowsOf = new Map(previews.map((preview) => [String(preview._id), preview.rows]));
  return {
    spaces,
    groups: pageSpaces.map((space) => ({ ...space, preview: membersOf(rowsOf.get(space.id) ?? [], toMember, space.id) })),
    page: query.page,
    pageSize: ADMIN_SPACES_PAGE_SIZE,
    people: peopleCount,
    noSpace: { members: noSpace.total, preview: membersOf(noSpace.rows, toMember, null) },
    totals,
  };
}

/** `GET /admin/spaces/:spaceId/members`: one page of a live space (or of «Sin espacio»); null when there is no such space. */
export async function adminSpaceMembers(spaceId: string, query: Query, now: number): Promise<AdminSpaceMembersPage | null> {
  const people = { ...PEOPLE, ...searchFilter(query.q) };
  const live = await liveSpaces();
  const pageOf = { page: query.page, pageSize: ADMIN_USERS_PAGE_SIZE };
  if (spaceId === ADMIN_NO_SPACE) {
    const found = await noSpaceRows(live.map((space) => space._id), people, (query.page - 1) * ADMIN_USERS_PAGE_SIZE, ADMIN_USERS_PAGE_SIZE);
    const toMember = await memberBuilder(found.rows, live);
    return { space: null, members: membersOf(found.rows, toMember, null), total: found.total, ...pageOf };
  }
  const space = live.find((candidate) => String(candidate._id) === spaceId);
  if (!space) return null;
  const [found, counts] = await Promise.all([spaceRows(space._id, people, query.page), countsBySpace([space._id], people, now)]);
  const toMember = await memberBuilder(found.rows, live);
  const [summary] = summaries([space], counts.length ? counts : [{ _id: space._id, members: 0, activeToday: 0 }]);
  return { space: summary ?? null, members: membersOf(found.rows, toMember, spaceId), total: found.total, ...pageOf };
}

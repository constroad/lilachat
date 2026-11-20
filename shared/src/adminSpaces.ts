import { adminUsersQuery, type AdminUser, type AdminUsersTotals } from './adminUsers.js';
import type { WorkspaceRole } from './workspaces.js';

/**
 * The superadmin's panel grouped by space (José, 14/11: people grouped by
 * the space they belong to; design `adm-01-usuarios-por-espacio`). Only
 * active members of live spaces; bots and Lila are not people, like the flat
 * list. A member hidden in a space (incognito) does show here, marked.
 *
 * `GET /api/admin/spaces?q=&page=` → `AdminSpacesOverview`
 * `GET /api/admin/spaces/:spaceId/members?q=&page=` → `AdminSpaceMembersPage`
 * (`:spaceId` is a space id or `none` for the people in no space).
 */
export type AdminSpaceRef = { id: string; name: string };
export type AdminSpaceSummary = AdminSpaceRef & { logoUrl: string | null; members: number; activeToday: number };
/** A person as seen from one space: their role there (null outside any space) and the other spaces they are in. */
export type AdminSpaceMember = AdminUser & { role: WorkspaceRole | null; hidden: boolean; alsoIn: AdminSpaceRef[] };
export type AdminSpaceGroup = AdminSpaceSummary & { preview: AdminSpaceMember[] };
export type AdminSpacesOverview = {
  /** Every space with someone matching the search: the filter column. */
  spaces: AdminSpaceSummary[];
  /** One page of those spaces, each with its first members. */
  groups: AdminSpaceGroup[];
  page: number;
  pageSize: number;
  /** People matching the search («Todos los espacios»). */
  people: number;
  noSpace: { members: number; preview: AdminSpaceMember[] };
  totals: AdminUsersTotals;
};
export type AdminSpaceMembersPage = { space: AdminSpaceSummary | null; members: AdminSpaceMember[]; total: number; page: number; pageSize: number };

export const ADMIN_SPACES_PAGE_SIZE = 10;
export const ADMIN_SPACE_PREVIEW = 4;
/** `:spaceId` of the people in no space. */
export const ADMIN_NO_SPACE = 'none';
/** The order of a space's members: who runs it first (design: Dueño, Admin, Miembro, Invitado). */
export const ADMIN_ROLE_ORDER: readonly WorkspaceRole[] = ['owner', 'admin', 'member', 'guest'];

/** `reports`: the queue of reports (Google Play, José 19/11). */
export type AdminPanelView = 'spaces' | 'people' | 'reports';
export type AdminPanelQuery = { view: AdminPanelView; space: string | null; q: string; page: number };

const SPACE_ID = /^[a-f0-9]{24}$/;
const PEOPLE_VIEW = 'personas';
const REPORTS_VIEW = 'denuncias';
const NO_SPACE_PARAM = 'sin';
const ALSO_IN_NAMED = 2;

function spaceFromParam(raw: unknown): string | null {
  if (raw === NO_SPACE_PARAM) return ADMIN_NO_SPACE;
  return typeof raw === 'string' && SPACE_ID.test(raw) ? raw : null;
}

/** The panel's state from the address (`?vista=personas&espacio=…&q=&page=`); anything else falls back. */
export function adminPanelQuery(raw: { vista?: unknown; espacio?: unknown; q?: unknown; page?: unknown }): AdminPanelQuery {
  const view: AdminPanelView = raw.vista === PEOPLE_VIEW ? 'people' : raw.vista === REPORTS_VIEW ? 'reports' : 'spaces';
  return { view, space: view === 'spaces' ? spaceFromParam(raw.espacio) : null, ...adminUsersQuery(raw) };
}

/** The address of that state: only what differs from the plain panel, so `/admin` is the default. */
export function adminPanelSearch(query: AdminPanelQuery): string {
  const params = new URLSearchParams();
  if (query.view === 'people') params.set('vista', PEOPLE_VIEW);
  if (query.view === 'reports') params.set('vista', REPORTS_VIEW);
  if (query.space) params.set('espacio', query.space === ADMIN_NO_SPACE ? NO_SPACE_PARAM : query.space);
  if (query.q) params.set('q', query.q);
  if (query.page > 1) params.set('page', String(query.page));
  const search = params.toString();
  return search ? `?${search}` : '';
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** «23 miembros · 9 activos hoy»: a space's header. */
export const adminSpaceLine = (space: Pick<AdminSpaceSummary, 'members' | 'activeToday'>): string =>
  `${plural(space.members, 'miembro', 'miembros')} · ${plural(space.activeToday, 'activo', 'activos')} hoy`;

/** «28 personas que todavía no están en ningún espacio». */
export const adminNoSpaceLine = (count: number): string =>
  count === 1 ? '1 persona que todavía no está en ningún espacio' : `${count} personas que todavía no están en ningún espacio`;

/** «También en ConstRoad y Test», «También en A, B y 2 más»; null when the person is in no other space. */
export function adminAlsoInLabel(spaces: AdminSpaceRef[]): string | null {
  if (spaces.length === 0) return null;
  const names = spaces.map((space) => space.name);
  if (names.length <= ALSO_IN_NAMED) return `También en ${names.join(' y ')}`;
  return `También en ${names.slice(0, ALSO_IN_NAMED).join(', ')} y ${names.length - ALSO_IN_NAMED} más`;
}

/** «Mostrando 4 espacios · 96 personas»: the footer of the grouped view. */
export function adminSpacesRange(counts: { spaces: number; people: number }): string {
  if (counts.spaces === 0 && counts.people === 0) return 'Sin resultados';
  return `Mostrando ${plural(counts.spaces, 'espacio', 'espacios')} · ${plural(counts.people, 'persona', 'personas')}`;
}

const roleRank = (role: WorkspaceRole | null): number => (role ? ADMIN_ROLE_ORDER.indexOf(role) : ADMIN_ROLE_ORDER.length);

/** Owner, admin, member, guest, and no role last. */
export const compareAdminRole = (a: WorkspaceRole | null, b: WorkspaceRole | null): number => roleRank(a) - roleRank(b);

import { canChangeRole, canDeactivate, type WorkspaceMemberStatus, type WorkspaceRole } from './workspaces.js';

/**
 * The enterprise screens (designs `e1-08` directory, `e1-10` members and
 * roles, `e1-11` requests, `e1-13` «te agregaron»). PURE.
 */
const ROLE_LABELS: Record<WorkspaceRole, string> = { owner: 'Dueño', admin: 'Admin', member: 'Miembro', guest: 'Invitado' };
export const roleLabel = (role: WorkspaceRole): string => ROLE_LABELS[role];

/** The areas offered when approving a request (design `e1-11`); the directory also shows any other written by hand. */
export const SPACE_AREAS = ['Obra', 'Planta', 'Flota', 'Admin.'] as const;

export type MemberAction = 'make-admin' | 'make-member' | 'make-guest' | 'deactivate' | 'reactivate';

/** What the ⋮ of a member offers (e1-10), with the same rules the server checks. */
export function memberActions(params: { actor: WorkspaceRole; target: { role: WorkspaceRole; status: WorkspaceMemberStatus } }): MemberAction[] {
  const { actor, target } = params;
  if (target.status === 'deactivated') return canDeactivate({ actor, target: target.role }) ? ['reactivate'] : [];
  const actions: MemberAction[] = [];
  const can = (to: WorkspaceRole) => to !== target.role && canChangeRole({ actor, target: target.role, to });
  if (can('admin')) actions.push('make-admin');
  if (target.role !== 'member' && can('member')) actions.push('make-member');
  // An admin first goes back to member: «invitado» is offered to a member only.
  if (target.role === 'member' && can('guest')) actions.push('make-guest');
  if (canDeactivate({ actor, target: target.role })) actions.push('deactivate');
  return actions;
}

/** What the server receives for each action of the ⋮. */
export function changeForAction(action: MemberAction): { role?: WorkspaceRole; status?: 'active' | 'deactivated' } {
  if (action === 'make-admin') return { role: 'admin' };
  if (action === 'make-member') return { role: 'member' };
  if (action === 'make-guest') return { role: 'guest' };
  return { status: action === 'deactivate' ? 'deactivated' : 'active' };
}

type Searchable = { name?: string; title?: string; area?: string; phone: string };
const folded = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '');

/** «Todas» and each area with how many are in it, the biggest first (e1-08). */
export function directoryAreas(members: readonly Searchable[]): { area: string | null; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const member of members) if (member.area) counts.set(member.area, (counts.get(member.area) ?? 0) + 1);
  const areas = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).map(([area, count]) => ({ area, label: area, count }));
  return [{ area: null, label: 'Todas', count: members.length }, ...areas];
}

/** Search by name, title, area or phone (accents and spaces ignored), then the chosen area. */
export function filterMembers<T extends Searchable>(members: readonly T[], params: { query: string; area: string | null }): T[] {
  const query = folded(params.query);
  return members.filter((member) => (!params.area || member.area === params.area) && (!query || folded(`${member.name ?? ''}${member.title ?? ''}${member.area ?? ''}${member.phone}`).includes(query)));
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** Peru has no daylight saving: Lima is always five hours behind UTC. */
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const limaDay = (date: Date) => {
  const lima = new Date(date.getTime() + LIMA_OFFSET_MS);
  return { year: lima.getUTCFullYear(), month: lima.getUTCMonth(), day: lima.getUTCDate(), key: Math.floor(lima.getTime() / (24 * HOUR_MS)) };
};

/** «Se unió»: «3 de agosto», with the year when it is another one. */
export function joinedLabel(at: string | Date, now: Date = new Date()): string {
  const day = limaDay(new Date(at));
  return `${day.day} de ${MONTHS[day.month]}${day.year === limaDay(now).year ? '' : ` de ${day.year}`}`;
}

/** When a request came: «hace 5 min», «hace 3 h», «ayer», or «el 12 de octubre». */
export function requestedAgo(at: string | Date, now: Date = new Date()): string {
  const date = new Date(at);
  const elapsed = now.getTime() - date.getTime();
  const days = limaDay(now).key - limaDay(date).key;
  if (days === 0 && elapsed < MINUTE_MS) return 'hace un momento';
  if (days === 0 && elapsed < HOUR_MS) return `hace ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (days === 0) return `hace ${Math.floor(elapsed / HOUR_MS)} h`;
  if (days === 1) return 'ayer';
  return `el ${joinedLabel(date, now)}`;
}

/** The spaces someone else added me to that I have not seen yet: each one opens «te agregaron» once (e1-13). */
export function newlyAddedSpaces<T extends { id: string; status: string; addedBy?: unknown }>(spaces: readonly T[], seen: readonly string[]): T[] {
  return spaces.filter((space) => space.status === 'active' && space.addedBy && !seen.includes(space.id));
}

import { formatClock, formatDayLabel } from './chatDisplay.js';

/**
 * The superadmin's users panel (José, 21/10: who is in Lilachat, when they
 * joined, basic information, never reading messages). `GET /api/admin/users`
 * returns people only, without bots or the built-in assistant, and nothing
 * from anyone's messages or contacts.
 */
export type AdminUser = {
  id: string;
  name: string | null;
  phone: string;
  avatarUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  /** Name, birthday and verified email: what «Completa tu perfil» asks (§93). */
  profileComplete: boolean;
  joinedAt: string;
  lastSeenAt: string | null;
  devices: { android: number; web: number };
  spaces: number;
  /** Who invited the number, by name or phone; null if nobody did. */
  invitedBy: string | null;
};

export type AdminUsersTotals = { people: number; newThisWeek: number; activeToday: number; profileComplete: number };
export type AdminUsersPage = { users: AdminUser[]; total: number; page: number; pageSize: number; totals: AdminUsersTotals };

export const ADMIN_USERS_PAGE_SIZE = 50;
const MAX_SEARCH = 60;

/** The list's query, clean: a page from 1 and a short search; anything else falls back. */
export function adminUsersQuery(raw: { q?: unknown; page?: unknown }): { q: string; page: number } {
  const q = typeof raw.q === 'string' ? raw.q.trim().slice(0, MAX_SEARCH) : '';
  const page = Number(raw.page);
  return { q, page: Number.isInteger(page) && page > 0 ? page : 1 };
}

/** «Mostrando 51–100 de 148»: the list's footer. */
export function adminUsersRange(page: Pick<AdminUsersPage, 'page' | 'pageSize' | 'total'>): string {
  if (page.total === 0) return 'Sin resultados';
  const from = (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.total);
  return `Mostrando ${from}–${to} de ${page.total}`;
}

/** «2 Android · 1 web», or «Sin dispositivos». */
export function adminDevicesLabel(devices: AdminUser['devices']): string {
  const parts = [devices.android ? `${devices.android} Android` : '', devices.web ? `${devices.web} web` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Sin dispositivos';
}

let joinedFormat: Intl.DateTimeFormat | null = null;

/** «21 oct. 2026»: when the person joined, with the year (the panel spans years). */
export function adminJoinedLabel(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return (joinedFormat ??= new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })).format(date);
}

/** «hoy 7:31 a. m.», «ayer 9:05 p. m.», «12 oct.»; «Nunca» if the account was never open. */
export function adminLastSeenLabel(at: string | null, now: Date = new Date()): string {
  if (!at) return 'Nunca';
  const day = formatDayLabel(at, now);
  if (day === 'Hoy') return `hoy ${formatClock(at)}`;
  if (day === 'Ayer') return `ayer ${formatClock(at)}`;
  return day;
}

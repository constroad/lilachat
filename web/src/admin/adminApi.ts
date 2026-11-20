import { useEffect, useState } from 'react';
import type { AdminReportsFilter, AdminReportsPage, AdminSpaceMembersPage, AdminSpacesOverview, AdminUsersPage, ReportOutcome } from '@lilachat/shared';
import { api } from '../api';

/** The superadmin's users panel (`server/src/adminRoutes.ts`). */
export const getAdminAccess = (jwt: string) => api<{ superadmin: boolean }>('/admin', { jwt });
export const getAdminUsers = (jwt: string, query: { q: string; page: number }, signal?: AbortSignal) =>
  api<AdminUsersPage>(`/admin/users?${new URLSearchParams({ q: query.q, page: String(query.page) })}`, { jwt, signal });
/** Grouped by space (José 14/11): the groups, and one space's members (`spaceId` = an id or `none`). */
export const getAdminSpaces = (jwt: string, query: { q: string; page: number }, signal?: AbortSignal) =>
  api<AdminSpacesOverview>(`/admin/spaces?${new URLSearchParams({ q: query.q, page: String(query.page) })}`, { jwt, signal });
export const getAdminSpaceMembers = (jwt: string, spaceId: string, query: { q: string; page: number }, signal?: AbortSignal) =>
  api<AdminSpaceMembersPage>(`/admin/spaces/${encodeURIComponent(spaceId)}/members?${new URLSearchParams({ q: query.q, page: String(query.page) })}`, { jwt, signal });

/** Whether Ajustes shows «Usuarios de Lilachat»: asked once per session, only when Ajustes opens. */
export function useSuperadmin(jwt: string, asking: boolean): boolean {
  // null = not asked yet; a failed answer (no network) is asked again the next time.
  const [superadmin, setSuperadmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!asking || superadmin !== null || !jwt) return;
    let alive = true;
    void getAdminAccess(jwt).then((result) => {
      if (!alive) return;
      if (result.ok) setSuperadmin(result.data.superadmin === true);
      else if (result.status === 403) setSuperadmin(false);
    });
    return () => {
      alive = false;
    };
  }, [jwt, asking, superadmin]);
  return superadmin === true;
}

/** The report queue (Google Play, José 19/11): `estado` open or closed, urgent first. */
export const getAdminReports = (jwt: string, query: { filter: AdminReportsFilter; page: number }, signal?: AbortSignal) =>
  api<AdminReportsPage>(`/admin/reports?${new URLSearchParams({ estado: query.filter === 'closed' ? 'cerradas' : 'abiertas', page: String(query.page) })}`, { jwt, signal });
export const closeAdminReport = (jwt: string, reportId: string, body: { outcome: ReportOutcome; note: string }) =>
  api<{ ok: true }>(`/admin/reports/${encodeURIComponent(reportId)}/close`, { jwt, body });

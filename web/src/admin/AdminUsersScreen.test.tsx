import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AdminUser, AdminUsersPage } from '@lilachat/shared';
import { AdminUsersScreen } from './AdminUsersScreen';

const ana: AdminUser = {
  id: 'u1',
  name: 'Ana',
  phone: '987654321',
  avatarUrl: null,
  email: 'ana@example.com',
  emailVerified: true,
  profileComplete: true,
  joinedAt: '2026-10-21T15:00:00.000Z',
  lastSeenAt: null,
  devices: { android: 1, web: 2 },
  spaces: 1,
  invitedBy: 'José',
};
const pageOf = (users: AdminUser[], extra: Partial<AdminUsersPage> = {}): AdminUsersPage => ({
  users,
  total: users.length,
  page: 1,
  pageSize: 50,
  totals: { people: 148, newThisWeek: 6, activeToday: 31, profileComplete: 20 },
  ...extra,
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

/** The superadmin's users panel (José, 21/10): who is in Lilachat, never their messages. */
describe('users panel (web)', () => {
  it('shows the totals and each person with their basic information', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, pageOf([ana])));
    render(<AdminUsersScreen jwt="jwt" />);
    const row = await screen.findByTestId('admin-usuario-u1');
    expect(within(row).getByText('Ana')).toBeTruthy();
    expect(within(row).getAllByText('ana@example.com').length).toBeGreaterThan(0);
    expect(within(row).getAllByText('1 Android · 2 web').length).toBeGreaterThan(0);
    expect(within(row).getAllByText('José').length).toBeGreaterThan(0);
    expect(screen.getByTestId('admin-total-people').textContent).toContain('148');
    expect(screen.getByTestId('admin-rango').textContent).toBe('Mostrando 1–1 de 1');
  });

  it('searches as you type, keeps it in the address and goes back to page 1', async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => (urls.push(String(input)), json(200, pageOf([ana]))));
    render(<AdminUsersScreen jwt="jwt" />);
    await screen.findByTestId('admin-usuario-u1');
    fireEvent.change(screen.getByTestId('admin-buscar'), { target: { value: 'ana' } });
    await waitFor(() => expect(urls.at(-1)).toContain('q=ana'));
    expect(urls.at(-1)).toContain('page=1');
    expect(window.location.search).toBe('?q=ana');
  });

  it('pages forward when there are more', async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => (urls.push(String(input)), json(200, pageOf([ana], { total: 120 }))));
    render(<AdminUsersScreen jwt="jwt" />);
    await screen.findByTestId('admin-usuario-u1');
    expect((screen.getByTestId('admin-anterior') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('admin-siguiente'));
    await waitFor(() => expect(urls.at(-1)).toContain('page=2'));
  });

  it('someone who is not the superadmin is told so; a failure is not «no results»', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(403, { message: 'Este panel es solo del superadmin.' }));
    render(<AdminUsersScreen jwt="jwt" />);
    expect((await screen.findByTestId('admin-sin-acceso')).textContent).toContain('solo del superadmin');
    cleanup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(500, {})).mockResolvedValueOnce(json(200, pageOf([ana])));
    render(<AdminUsersScreen jwt="jwt" />);
    fireEvent.click(await screen.findByTestId('admin-reintentar'));
    await screen.findByTestId('admin-usuario-u1');
  });
});

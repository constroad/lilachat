import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AdminSpaceMember, AdminSpaceMembersPage, AdminSpacesOverview, AdminUser, AdminUsersPage } from '@lilachat/shared';
import { AdminUsersScreen } from './AdminUsersScreen';

const GF = '65a1b2c3d4e5f60718293a4b';
const CR = '65a1b2c3d4e5f60718293a4c';
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
const totals = { people: 148, newThisWeek: 6, activeToday: 31, profileComplete: 20 };
const pageOf = (users: AdminUser[], extra: Partial<AdminUsersPage> = {}): AdminUsersPage => ({ users, total: users.length, page: 1, pageSize: 50, totals, ...extra });
const anaIn = (extra: Partial<AdminSpaceMember> = {}): AdminSpaceMember => ({ ...ana, spaces: 2, role: 'owner', hidden: false, alsoIn: [{ id: CR, name: 'ConstRoad' }], ...extra });
const beto: AdminSpaceMember = { ...ana, id: 'u2', name: 'Beto', phone: '911222333', role: 'guest', hidden: true, alsoIn: [] };
const overview = (extra: Partial<AdminSpacesOverview> = {}): AdminSpacesOverview => ({
  spaces: [
    { id: GF, name: 'Globofast', logoUrl: null, members: 23, activeToday: 9 },
    { id: CR, name: 'ConstRoad', logoUrl: null, members: 1, activeToday: 1 },
  ],
  groups: [
    { id: GF, name: 'Globofast', logoUrl: null, members: 23, activeToday: 9, preview: [anaIn(), beto] },
    { id: CR, name: 'ConstRoad', logoUrl: null, members: 1, activeToday: 1, preview: [anaIn({ id: 'u1', role: 'member', alsoIn: [{ id: GF, name: 'Globofast' }] })] },
  ],
  page: 1,
  pageSize: 10,
  people: 96,
  noSpace: { members: 28, preview: [{ ...ana, id: 'u9', name: 'Diego', spaces: 0, role: null, hidden: false, alsoIn: [] }] },
  totals,
  ...extra,
});
const membersPage = (extra: Partial<AdminSpaceMembersPage> = {}): AdminSpaceMembersPage => ({
  space: { id: GF, name: 'Globofast', logoUrl: null, members: 23, activeToday: 9 },
  members: [anaIn(), beto],
  total: 120,
  page: 1,
  pageSize: 50,
  ...extra,
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Answers each endpoint of the panel and keeps the URLs it was asked. */
function serve(bodies: { users?: AdminUsersPage; spaces?: AdminSpacesOverview; members?: AdminSpaceMembersPage }): string[] {
  const urls: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/members')) return json(200, bodies.members ?? membersPage());
    if (url.includes('/admin/spaces')) return json(200, bodies.spaces ?? overview());
    return json(200, bodies.users ?? pageOf([ana]));
  });
  return urls;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

/** The superadmin's users panel (José, 21/10): who is in Lilachat, never their messages. */
describe('users panel, every person (web)', () => {
  const openPeople = () => window.history.replaceState(null, '', '/admin?vista=personas');

  it('shows the totals and each person with their basic information', async () => {
    openPeople();
    serve({});
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
    openPeople();
    const urls = serve({});
    render(<AdminUsersScreen jwt="jwt" />);
    await screen.findByTestId('admin-usuario-u1');
    fireEvent.change(screen.getByTestId('admin-buscar'), { target: { value: 'ana' } });
    await waitFor(() => expect(urls.at(-1)).toContain('q=ana'));
    expect(urls.at(-1)).toContain('page=1');
    expect(window.location.search).toBe('?vista=personas&q=ana');
  });

  it('pages forward when there are more', async () => {
    openPeople();
    const urls = serve({ users: pageOf([ana], { total: 120 }) });
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
    openPeople();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(500, {})).mockResolvedValueOnce(json(200, pageOf([ana])));
    render(<AdminUsersScreen jwt="jwt" />);
    fireEvent.click(await screen.findByTestId('admin-reintentar'));
    await screen.findByTestId('admin-usuario-u1');
  });
});

/** José, 14/11: people grouped by the space they belong to (design `adm-01-usuarios-por-espacio`). */
describe('users panel, by space (web)', () => {
  it('opens by space: the filter with counts, one card per space with roles, «También en», «Oculto» and «Sin espacio»', async () => {
    // Arrange
    const urls = serve({});
    // Act
    render(<AdminUsersScreen jwt="jwt" />);
    const card = await screen.findByTestId(`admin-espacio-${GF}`);
    // Assert
    expect(urls[0]).toContain('/api/admin/spaces?');
    expect(within(card).getByText('23 miembros · 9 activos hoy')).toBeTruthy();
    const anaRow = within(card).getByTestId('admin-miembro-u1');
    expect(within(anaRow).getAllByText('Dueño').length).toBeGreaterThan(0);
    expect(within(anaRow).getByText('También en ConstRoad')).toBeTruthy();
    expect(within(within(card).getByTestId('admin-miembro-u2')).getAllByText('Oculto').length).toBeGreaterThan(0);
    expect(screen.getByTestId('admin-sin-espacio').textContent).toContain('28 personas que todavía no están en ningún espacio');
    expect(screen.getAllByTestId(`admin-filtro-${GF}`)[0]?.textContent).toContain('23');
    expect(screen.getByTestId('admin-total-people').textContent).toContain('148');
  });

  it('«Ver los 23 de Globofast» selects that space: its members, paged, and the address says so', async () => {
    const urls = serve({});
    render(<AdminUsersScreen jwt="jwt" />);
    fireEvent.click(await screen.findByTestId(`admin-ver-${GF}`));
    await waitFor(() => expect(urls.some((url) => url.includes(`/admin/spaces/${GF}/members`))).toBe(true));
    expect(window.location.search).toBe(`?espacio=${GF}`);
    await screen.findByTestId('admin-miembro-u2');
    expect(screen.getByTestId('admin-rango').textContent).toBe('Mostrando 1–50 de 120');
    fireEvent.click(screen.getByTestId('admin-siguiente'));
    await waitFor(() => expect(urls.at(-1)).toContain('page=2'));
  });

  it('a filter chip selects «Sin espacio»; «Todos» goes back to the groups', async () => {
    const urls = serve({ members: membersPage({ space: null, members: [], total: 0 }) });
    render(<AdminUsersScreen jwt="jwt" />);
    fireEvent.click((await screen.findAllByTestId('admin-filtro-sin'))[0]!);
    await waitFor(() => expect(urls.at(-1)).toContain('/admin/spaces/none/members'));
    expect(await screen.findByTestId('admin-vacio')).toBeTruthy();
    fireEvent.click(screen.getAllByTestId('admin-filtro-todos')[0]!);
    await screen.findByTestId(`admin-espacio-${GF}`);
    expect(window.location.search).toBe('');
  });

  it('«Contraer» hides a space\'s people and «Expandir» brings them back', async () => {
    serve({});
    render(<AdminUsersScreen jwt="jwt" />);
    const card = await screen.findByTestId(`admin-espacio-${GF}`);
    fireEvent.click(within(card).getByRole('button', { name: /contraer/i }));
    expect(within(card).queryByTestId('admin-miembro-u1')).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: /expandir/i }));
    expect(within(card).getByTestId('admin-miembro-u1')).toBeTruthy();
  });

  it('a contracted space stays contracted after a search reloads the groups', async () => {
    const urls = serve({});
    render(<AdminUsersScreen jwt="jwt" />);
    const card = await screen.findByTestId(`admin-espacio-${GF}`);
    fireEvent.click(within(card).getByRole('button', { name: /contraer/i }));
    // A slow answer, as in production: the skeleton replaces the cards meanwhile.
    const answer = vi.mocked(globalThis.fetch).getMockImplementation()!;
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return answer(input, init);
    });
    fireEvent.change(screen.getByTestId('admin-buscar'), { target: { value: 'an' } });
    await waitFor(() => expect(urls.at(-1)).toContain('q=an'));
    // The reload unmounts the cards: wait for the new one, not the old node.
    await waitFor(() => expect(screen.getByTestId(`admin-espacio-${GF}`)).not.toBe(card));
    const again = screen.getByTestId(`admin-espacio-${GF}`);
    expect(within(again).getByRole('button', { name: /expandir/i })).toBeTruthy();
    expect(within(again).queryByTestId('admin-miembro-u1')).toBeNull();
  });

  it('a chosen space with nobody active says so, without talking about a search', async () => {
    window.history.replaceState(null, '', `/?espacio=${GF}`);
    serve({ members: membersPage({ members: [], total: 0 }) });
    render(<AdminUsersScreen jwt="jwt" />);
    expect((await screen.findByTestId('admin-vacio')).textContent).toBe('Este espacio no tiene miembros activos.');
  });

  it('the toggle switches to every person, and a search with nobody says so', async () => {
    const urls = serve({ spaces: overview({ spaces: [], groups: [], people: 0, noSpace: { members: 0, preview: [] } }) });
    render(<AdminUsersScreen jwt="jwt" />);
    expect(await screen.findByTestId('admin-vacio')).toBeTruthy();
    fireEvent.click(screen.getByTestId('admin-vista-personas'));
    await screen.findByTestId('admin-usuario-u1');
    expect(urls.at(-1)).toContain('/admin/users?');
    expect(window.location.search).toBe('?vista=personas');
  });
});

/** Google Play (José 19/11): «Denuncias» is a third view of the panel, `?vista=denuncias`. */
describe('users panel, the reports view (web)', () => {
  it('the toggle opens the queue and writes it in the address', async () => {
    // Arrange
    const urls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      urls.push(String(input));
      if (String(input).includes('/admin/reports')) return json(200, { reports: [], total: 0, open: 0, page: 1, pageSize: 30 });
      return json(200, overview());
    });
    render(<AdminUsersScreen jwt="jwt" />);
    // Act
    fireEvent.click(await screen.findByTestId('admin-vista-denuncias'));
    // Assert
    expect(await screen.findByText('No hay denuncias abiertas.')).toBeTruthy();
    expect(window.location.search).toBe('?vista=denuncias');
    expect(screen.queryByTestId('admin-buscar')).toBeNull();
    await waitFor(() => expect(urls).toContain('/api/admin/reports?estado=abiertas&page=1'));
  });
});

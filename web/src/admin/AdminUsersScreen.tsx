import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { adminDevicesLabel, adminJoinedLabel, adminLastSeenLabel, adminPanelQuery, adminPanelSearch, adminUsersRange, type AdminPanelQuery, type AdminPanelView, type AdminUser, type AdminUsersPage, type AdminUsersTotals } from '@lilachat/shared';
import { Logo } from '../ui/Logo';
import { getAdminSpaceMembers, getAdminSpaces, getAdminUsers } from './adminApi';
import { Cell, Dash, EmailValue, EmptyNote, ErrorNote, KICKER, Pager, PersonCell, SkeletonRows, lastPage } from './AdminParts';
import { AdminSpacesView } from './AdminSpacesView';
import { useAdminLoad, type AdminLoad } from './useAdminLoad';

const SEARCH_DEBOUNCE_MS = 300;
const COLUMNS = 'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_1fr_1fr_1.1fr_0.6fr_1fr] md:items-center md:gap-4';

function queryFromAddress(): AdminPanelQuery {
  return adminPanelQuery(Object.fromEntries(new URLSearchParams(window.location.search)));
}

/** The panel's state lives in the address (`?vista=&espacio=&q=&page=`), so a reload or a shared link opens the same list. */
function writeAddress(query: AdminPanelQuery): void {
  window.history.replaceState(null, '', `${window.location.pathname}${adminPanelSearch(query)}`);
}

/** The reads of the open view: the flat list, or the groups plus (with a space chosen) its members. */
function usePanelLoads(jwt: string, query: AdminPanelQuery, attempt: number) {
  const { view, space, q, page } = query;
  const groupsPage = space ? 1 : page;
  const users = useCallback((signal: AbortSignal) => getAdminUsers(jwt, { q, page }, signal), [jwt, q, page]);
  const groups = useCallback((signal: AbortSignal) => getAdminSpaces(jwt, { q, page: groupsPage }, signal), [jwt, q, groupsPage]);
  const members = useCallback((signal: AbortSignal) => getAdminSpaceMembers(jwt, space ?? '', { q, page }, signal), [jwt, space, q, page]);
  return {
    users: useAdminLoad(view === 'people' ? users : null, attempt),
    groups: useAdminLoad(view === 'spaces' ? groups : null, attempt),
    members: useAdminLoad(view === 'spaces' && space ? members : null, attempt),
  };
}

/** The 403 of any open read: the panel is only the superadmin's. */
function forbiddenMessage(loads: AdminLoad<unknown>[]): string | null {
  for (const load of loads) if (load.status === 'error' && load.forbidden) return load.message;
  return null;
}

function totalsOf(load: AdminLoad<{ totals: AdminUsersTotals }>): AdminUsersTotals | null {
  return load.status === 'ready' ? load.data.totals : null;
}

/**
 * The superadmin's users panel (José, 21/10): who is in Lilachat, when they
 * joined and basic information; grouped by space by default (José 14/11).
 * No chat or message of anyone: the server does not send them (`adminRoutes.ts`).
 */
export function AdminUsersScreen({ jwt }: { jwt: string }) {
  const [query, setQuery] = useState<AdminPanelQuery>(queryFromAddress);
  const [text, setText] = useState(query.q);
  const [attempt, setAttempt] = useState(0);
  const loads = usePanelLoads(jwt, query, attempt);
  useEffect(() => {
    writeAddress(query);
  }, [query]);
  useEffect(() => {
    if (text.trim() === query.q) return;
    const timer = window.setTimeout(() => setQuery((current) => ({ ...current, q: text.trim(), page: 1 })), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text, query.q]);

  const visible = query.view === 'people' ? [loads.users] : [loads.groups, ...(query.space ? [loads.members] : [])];
  const forbidden = forbiddenMessage(visible);
  if (forbidden) {
    return (
      <Frame>
        <p data-testid="admin-sin-acceso" className="mt-10 rounded-xl border border-outline/15 bg-surface p-6 text-center text-sm text-on-surface-variant">{forbidden}</p>
      </Frame>
    );
  }
  const retry = () => setAttempt((count) => count + 1);
  const totals = totalsOf(query.view === 'people' ? loads.users : loads.groups);
  return (
    <Frame>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Superadmin</p>
          <h1 className="mt-1 text-2xl font-bold md:text-3xl">Usuarios de Lilachat</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Quién está, en qué espacio y desde cuándo. Sin chats ni mensajes.</p>
        </div>
        <ViewToggle view={query.view} onView={(view) => setQuery((current) => ({ ...current, view, space: null, page: 1 }))} />
      </div>
      <Totals totals={totals} />
      <label className="mt-6 flex h-12 items-center gap-2 rounded-lg border border-outline/20 bg-surface px-3 focus-within:border-primary">
        <Search size={16} className="text-on-surface-variant" />
        <input data-testid="admin-buscar" value={text} onChange={(event) => setText(event.target.value)} placeholder="Buscar por nombre, correo o teléfono" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      {query.view === 'people' ? (
        <PeopleList load={loads.users} onPage={(page) => setQuery((current) => ({ ...current, page }))} onRetry={retry} />
      ) : (
        <AdminSpacesView overview={loads.groups} members={query.space ? loads.members : null} space={query.space} onSpace={(space) => setQuery((current) => ({ ...current, space, page: 1 }))} onPage={(page) => setQuery((current) => ({ ...current, page }))} onRetry={retry} />
      )}
    </Frame>
  );
}

function ViewToggle({ view, onView }: { view: AdminPanelView; onView: (view: AdminPanelView) => void }) {
  const options: { value: AdminPanelView; label: string; testid: string }[] = [
    { value: 'spaces', label: 'Por espacio', testid: 'admin-vista-espacios' },
    { value: 'people', label: 'Todas las personas', testid: 'admin-vista-personas' },
  ];
  return (
    <div role="group" aria-label="Vista" className="flex rounded-lg border border-outline/15 bg-surface p-1 max-sm:w-full">
      {options.map((option) => (
        <button key={option.value} type="button" data-testid={option.testid} aria-pressed={view === option.value} onClick={() => view !== option.value && onView(option.value)} className={`h-10 rounded-md px-4 text-sm font-semibold max-sm:flex-1 ${view === option.value ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-on-surface">
      <header className="sticky top-0 z-10 border-b border-outline/10 bg-surface">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
          <a href="/" data-testid="admin-volver" aria-label="Volver a los chats" title="Volver a los chats" className="flex h-11 items-center gap-2 rounded-full pr-3 text-sm text-on-surface-variant hover:bg-background">
            <span className="grid h-11 w-11 place-items-center"><ArrowLeft size={20} /></span>
            <span className="max-md:hidden">Volver a los chats</span>
          </a>
          <span aria-hidden className="mx-1 h-6 border-l border-outline/20 max-md:hidden" />
          <Logo size={24} />
          <span className="font-bold">Lilachat</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}

function Totals({ totals }: { totals: AdminUsersTotals | null }) {
  const items: { key: keyof AdminUsersTotals; label: string }[] = [
    { key: 'people', label: 'Personas' },
    { key: 'newThisWeek', label: 'Nuevas esta semana' },
    { key: 'activeToday', label: 'Activas hoy' },
    { key: 'profileComplete', label: 'Perfil completo' },
  ];
  return (
    <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-outline/15 bg-surface sm:grid-cols-4 sm:divide-x sm:divide-outline/10">
      {items.map((item) => (
        <div key={item.key} data-testid={`admin-total-${item.key}`} className="border-outline/10 p-4 max-sm:odd:border-r max-sm:[&:nth-child(-n+2)]:border-b">
          <p className={KICKER}>{item.label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{totals ? totals[item.key] : '—'}</p>
        </div>
      ))}
    </div>
  );
}

/** «Todas las personas»: the flat list of every person, newest first (the panel before 14/11). */
function PeopleList({ load, onPage, onRetry }: { load: AdminLoad<AdminUsersPage>; onPage: (page: number) => void; onRetry: () => void }) {
  const page = load.status === 'ready' ? load.data : null;
  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-outline/15 bg-surface">
      <div className={`hidden border-b border-outline/10 px-4 py-2 ${COLUMNS} ${KICKER}`}>
        <span>Persona</span><span>Correo</span><span>Se unió</span><span>Última vez</span><span>Dispositivos</span><span>Espacios</span><span>Lo invitó</span>
      </div>
      {load.status === 'error' ? <ErrorNote message={load.message} onRetry={onRetry} /> : page ? <UserList users={page.users} /> : <SkeletonRows />}
      {page ? <Pager label={adminUsersRange(page)} page={page.page} last={lastPage(page.total, page.pageSize)} onPage={onPage} /> : null}
    </section>
  );
}

function UserList({ users }: { users: AdminUser[] }) {
  if (users.length === 0) return <EmptyNote />;
  return (
    <ul className="divide-y divide-outline/10">
      {users.map((user) => (
        <li key={user.id} data-testid={`admin-usuario-${user.id}`} className={`grid gap-1 px-4 py-3 ${COLUMNS}`}>
          <PersonCell user={user} />
          <Cell label="Correo"><EmailValue user={user} /></Cell>
          <Cell label="Se unió">{adminJoinedLabel(user.joinedAt)}</Cell>
          <Cell label="Última vez">{adminLastSeenLabel(user.lastSeenAt)}</Cell>
          <Cell label="Dispositivos">{adminDevicesLabel(user.devices)}</Cell>
          <Cell label="Espacios"><span className="tabular-nums">{user.spaces}</span></Cell>
          <Cell label="Lo invitó">{user.invitedBy ?? <Dash />}</Cell>
        </li>
      ))}
    </ul>
  );
}

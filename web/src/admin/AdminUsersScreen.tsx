import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { adminDevicesLabel, adminJoinedLabel, adminLastSeenLabel, adminUsersQuery, adminUsersRange, type AdminUser, type AdminUsersPage } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';
import { getAdminUsers } from './adminApi';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 6;
const KICKER = 'text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant';
const COLUMNS = 'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_1fr_1fr_1.1fr_0.6fr_1fr] md:items-center md:gap-4';

type Query = { q: string; page: number };
type Load = { status: 'loading' } | { status: 'ready'; page: AdminUsersPage } | { status: 'error'; forbidden: boolean; message: string };

function queryFromAddress(): Query {
  return adminUsersQuery(Object.fromEntries(new URLSearchParams(window.location.search)));
}

/** The list's state lives in the address (`?q=&page=`), so a reload or a shared link opens the same list. */
function writeAddress(query: Query): void {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.page > 1) params.set('page', String(query.page));
  const search = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
}

function useAdminUsers(jwt: string, query: Query, attempt: number): Load {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: 'loading' });
    void getAdminUsers(jwt, query, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setLoad(result.ok ? { status: 'ready', page: result.data } : { status: 'error', forbidden: result.status === 403, message: result.message });
    });
    return () => controller.abort();
  }, [jwt, query, attempt]);
  return load;
}

/**
 * The superadmin's users panel (José, 21/10): who is in Lilachat, when they
 * joined and basic information. No chat or message of anyone: the server does
 * not send them (`adminRoutes.ts`).
 */
export function AdminUsersScreen({ jwt }: { jwt: string }) {
  const [query, setQuery] = useState<Query>(queryFromAddress);
  const [text, setText] = useState(query.q);
  const [attempt, setAttempt] = useState(0);
  const load = useAdminUsers(jwt, query, attempt);
  useEffect(() => {
    writeAddress(query);
  }, [query]);
  useEffect(() => {
    if (text.trim() === query.q) return;
    const timer = window.setTimeout(() => setQuery({ q: text.trim(), page: 1 }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text, query.q]);

  if (load.status === 'error' && load.forbidden) {
    return (
      <Frame>
        <p data-testid="admin-sin-acceso" className="mt-10 rounded-xl border border-outline/15 bg-surface p-6 text-center text-sm text-on-surface-variant">{load.message}</p>
      </Frame>
    );
  }
  const page = load.status === 'ready' ? load.page : null;
  return (
    <Frame>
      <p className={KICKER}>Superadmin</p>
      <h1 className="mt-1 text-2xl font-bold">Usuarios de Lilachat</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Quién está y desde cuándo. Sin chats ni mensajes.</p>
      <Totals page={page} />
      <label className="mt-6 flex h-11 items-center gap-2 rounded-lg border border-outline/20 bg-surface px-3 focus-within:border-primary">
        <Search size={16} className="text-on-surface-variant" />
        <input data-testid="admin-buscar" value={text} onChange={(event) => setText(event.target.value)} placeholder="Buscar por nombre, correo o teléfono" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <section className="mt-4 overflow-hidden rounded-xl border border-outline/15 bg-surface">
        <div className={`hidden border-b border-outline/10 px-4 py-2 ${COLUMNS} ${KICKER}`}>
          <span>Persona</span><span>Correo</span><span>Se unió</span><span>Última vez</span><span>Dispositivos</span><span>Espacios</span><span>Lo invitó</span>
        </div>
        {load.status === 'error' ? (
          <div className="p-6 text-center text-sm">
            <p className="text-error">{load.message}</p>
            <button type="button" data-testid="admin-reintentar" onClick={() => setAttempt((count) => count + 1)} className="mt-3 h-11 rounded-lg border border-primary/40 px-4 font-semibold text-primary">Reintentar</button>
          </div>
        ) : page ? (
          <UserList users={page.users} />
        ) : (
          <SkeletonRows />
        )}
        {page ? <Pager page={page} onPage={(next) => setQuery({ ...query, page: next })} /> : null}
      </section>
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-on-surface">
      <header className="sticky top-0 z-10 border-b border-outline/10 bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <a href="/" data-testid="admin-volver" aria-label="Volver a los chats" title="Volver a los chats" className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background">
            <ArrowLeft size={20} />
          </a>
          <Logo size={24} />
          <span className="font-bold">Lilachat</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}

function Totals({ page }: { page: AdminUsersPage | null }) {
  const items: { key: keyof AdminUsersPage['totals']; label: string }[] = [
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
          <p className="mt-1 text-3xl font-bold tabular-nums">{page ? page.totals[item.key] : '—'}</p>
        </div>
      ))}
    </div>
  );
}

/** On a phone each cell carries its label; from `md` the header row names the columns. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 text-sm">
      <span className="text-[11px] text-on-surface-variant md:hidden">{label} · </span>
      {children}
    </div>
  );
}

function UserList({ users }: { users: AdminUser[] }) {
  if (users.length === 0) return <p className="p-6 text-center text-sm text-on-surface-variant">Nadie coincide con esa búsqueda.</p>;
  return (
    <ul className="divide-y divide-outline/10">
      {users.map((user) => (
        <li key={user.id} data-testid={`admin-usuario-${user.id}`} className={`grid gap-1 px-4 py-3 ${COLUMNS}`}>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={user.name ?? user.phone} foto={user.avatarUrl ?? undefined} size={36} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.name ?? 'Sin nombre'}</p>
              <p className="font-mono text-[12px] text-on-surface-variant">{user.phone}</p>
            </div>
          </div>
          <Cell label="Correo">
            {user.email ? (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                <span className="truncate">{user.email}</span>
                {user.emailVerified ? <BadgeCheck size={14} aria-label="Verificado" className="shrink-0 text-en-linea" /> : <span className="shrink-0 text-[11px] text-on-surface-variant">(sin verificar)</span>}
              </span>
            ) : (
              <span className="text-on-surface-variant">—</span>
            )}
          </Cell>
          <Cell label="Se unió">{adminJoinedLabel(user.joinedAt)}</Cell>
          <Cell label="Última vez">{adminLastSeenLabel(user.lastSeenAt)}</Cell>
          <Cell label="Dispositivos">{adminDevicesLabel(user.devices)}</Cell>
          <Cell label="Espacios"><span className="tabular-nums">{user.spaces}</span></Cell>
          <Cell label="Lo invitó">{user.invitedBy ?? <span className="text-on-surface-variant">—</span>}</Cell>
        </li>
      ))}
    </ul>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-outline/10" aria-busy="true">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-background" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-background" />
        </div>
      ))}
    </div>
  );
}

function Pager({ page, onPage }: { page: AdminUsersPage; onPage: (page: number) => void }) {
  const last = Math.max(1, Math.ceil(page.total / page.pageSize));
  const button = 'grid h-11 w-11 place-items-center rounded-lg border border-outline/20 disabled:opacity-40';
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-outline/10 px-4 py-2 text-sm text-on-surface-variant">
      <span data-testid="admin-rango">{adminUsersRange(page)}</span>
      <div className="flex gap-2">
        <button type="button" data-testid="admin-anterior" aria-label="Página anterior" disabled={page.page <= 1} onClick={() => onPage(page.page - 1)} className={button}><ChevronLeft size={16} /></button>
        <button type="button" data-testid="admin-siguiente" aria-label="Página siguiente" disabled={page.page >= last} onClick={() => onPage(page.page + 1)} className={button}><ChevronRight size={16} /></button>
      </div>
    </footer>
  );
}

import type { ReactNode } from 'react';
import { BadgeCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatPhoneDisplay, type AdminUser } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';

/** Pieces both views of the superadmin's panel share: the flat list and the one grouped by space. */
export const KICKER = 'text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant';
const SKELETON_ROWS = 6;

/** On a phone each cell carries its label; from `md` the header row names the columns. */
export function Cell({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 text-sm ${className}`}>
      <span className="text-[11px] text-on-surface-variant md:hidden">{label} · </span>
      {children}
    </div>
  );
}

export const Dash = () => <span className="text-on-surface-variant">—</span>;

/** Avatar, name and phone; `under` goes below the phone (the «También en» chip), `aside` at the right on a phone (the role). */
export function PersonCell({ user, under, aside }: { user: AdminUser; under?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={user.name ?? user.phone} foto={user.avatarUrl ?? undefined} size={36} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words font-semibold">{user.name ?? 'Sin nombre'}</p>
        <p className="font-mono text-[12px] text-on-surface-variant">{formatPhoneDisplay(user.phone)}</p>
        {under}
      </div>
      {aside}
    </div>
  );
}

export function EmailValue({ user }: { user: AdminUser }) {
  if (!user.email) return <Dash />;
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      <span className="truncate">{user.email}</span>
      {user.emailVerified ? <BadgeCheck size={14} aria-label="Verificado" className="shrink-0 text-en-linea" /> : <span className="shrink-0 text-[11px] text-on-surface-variant">(sin verificar)</span>}
    </span>
  );
}

export function SkeletonRows() {
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

export function ErrorNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-6 text-center text-sm">
      <p className="text-error">{message}</p>
      <button type="button" data-testid="admin-reintentar" onClick={onRetry} className="mt-3 h-11 rounded-lg border border-primary/40 px-4 font-semibold text-primary">Reintentar</button>
    </div>
  );
}

export const EmptyNote = ({ text = 'Nadie coincide con esa búsqueda.' }: { text?: string }) => <p data-testid="admin-vacio" className="p-6 text-center text-sm text-on-surface-variant">{text}</p>;

/** «Mostrando …» and the previous/next buttons; `last` is the last page. */
export function Pager({ label, page, last, onPage }: { label: string; page: number; last: number; onPage: (page: number) => void }) {
  const button = 'grid h-11 w-11 place-items-center rounded-lg border border-outline/20 disabled:opacity-40';
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-outline/10 px-4 py-2 text-sm text-on-surface-variant">
      <span data-testid="admin-rango">{label}</span>
      <div className="flex gap-2">
        <button type="button" data-testid="admin-anterior" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)} className={button}><ChevronLeft size={16} /></button>
        <button type="button" data-testid="admin-siguiente" aria-label="Página siguiente" disabled={page >= last} onClick={() => onPage(page + 1)} className={button}><ChevronRight size={16} /></button>
      </div>
    </footer>
  );
}

export const lastPage = (total: number, pageSize: number): number => Math.max(1, Math.ceil(total / pageSize));

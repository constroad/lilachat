import { useEffect, type ReactNode } from 'react';
import { CircleCheck, ChevronRight, KeyRound, Plus, X } from 'lucide-react';
import { spaceInitials, spaceSubtitle, type ClientWorkspace } from '@lilachat/shared';
import { SpaceLogo } from './SpaceLogo';

const STATUS_PILL: Partial<Record<ClientWorkspace['status'], string>> = { pending: 'PENDIENTE', deactivated: 'SIN ACCESO' };

/**
 * «Cambiar de espacio» (design `e1-06-selector-espacios`): the personal
 * account and each space with its unread chats, the active one marked, and
 * joining with a code or creating one. Asks the list again when it opens.
 */
export function SpaceSwitcher(props: { spaces: readonly ClientWorkspace[] | null; currentId: string | null; me: { name?: string | null; phone: string }; personalUnread: number; onPick: (spaceId: string | null) => void; onJoin: () => void; onCreate: () => void; onClose: () => void; onOpen: () => void }) {
  const { onOpen, onClose } = props;
  useEffect(() => {
    onOpen();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Once per opening: the list is asked again when the switcher shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badge = (count: number) => (count > 0 ? <span className="grid h-6 min-w-[24px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">{count}</span> : null);
  const row = (key: string, active: boolean, disabled: boolean, onPick: () => void, body: ReactNode) => (
    <button key={key} type="button" data-testid={`selector-${key}`} disabled={disabled} aria-current={active} onClick={onPick} className={`flex min-h-[64px] w-full items-center gap-3 rounded-xl border px-3 text-left ${active ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-background'} ${disabled ? 'opacity-60' : ''}`}>
      {body}
    </button>
  );

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 p-0 sm:justify-start sm:p-3" onClick={onClose}>
      <div data-testid="selector-de-espacios" role="dialog" aria-label="Cambiar de espacio" onClick={(event) => event.stopPropagation()} className="mt-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:mt-0 sm:w-[420px] sm:rounded-2xl">
        <header className="flex items-start gap-2 border-b border-outline/15 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Tus espacios</p>
            <h2 className="text-lg font-bold tracking-tight">Cambiar de espacio</h2>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-background">
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {row('personal', props.currentId === null, false, () => props.onPick(null), (
            <>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{spaceInitials(props.me.name || props.me.phone)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Personal</span>
                <span className="block truncate text-[13px] text-on-surface-variant">{`${props.me.name || props.me.phone} · Chats directos`}</span>
              </span>
              {badge(props.personalUnread)}
              {props.currentId === null ? <CircleCheck size={22} className="text-primary" /> : <ChevronRight size={18} className="text-outline" />}
            </>
          ))}
          {props.spaces === null ? <div className="h-16 animate-pulse rounded-xl bg-background" /> : null}
          {(props.spaces ?? []).map((space) => {
            const active = props.currentId === space.id;
            const blocked = space.status !== 'active';
            return row(space.id, active, blocked, () => props.onPick(space.id), (
              <>
                <SpaceLogo space={space} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-bold">{space.name}</span>
                    {active ? <span className="rounded border border-primary/30 bg-primary/10 px-1.5 text-[10px] font-bold text-primary">ACTIVO</span> : null}
                    {STATUS_PILL[space.status] ? <span className="rounded bg-surface-variant px-1.5 text-[10px] font-bold text-on-surface-variant">{STATUS_PILL[space.status]}</span> : null}
                  </span>
                  <span className="block truncate text-[13px] text-on-surface-variant">{spaceSubtitle(space)}</span>
                </span>
                {blocked ? null : badge(space.unreadChats)}
                {active ? <CircleCheck size={22} className="text-primary" /> : blocked ? null : <ChevronRight size={18} className="text-outline" />}
              </>
            ));
          })}
        </div>
        <footer className="space-y-2 border-t border-outline/15 p-3">
          <button type="button" data-testid="selector-unirme" onClick={props.onJoin} className="flex h-11 w-full items-center gap-2 rounded-xl border border-outline/25 px-3 text-sm font-semibold hover:bg-background">
            <KeyRound size={16} className="text-on-surface-variant" /> Unirme con un código
          </button>
          <button type="button" data-testid="selector-crear" onClick={props.onCreate} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-on-primary">
            <Plus size={16} /> Crear un espacio
          </button>
        </footer>
      </div>
    </div>
  );
}

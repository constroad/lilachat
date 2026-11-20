import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronLeft, ExternalLink, Link2, MoreVertical } from 'lucide-react';
import { CLIENT_SERVICE_STATUS_LABELS, serviceHeadLine, SHELL_MIN_HEIGHT_PX, SHELL_WIDE_MIN_PX, type ServiceTabItem, type ServiceTabKey, type SpaceClientService } from '@lilachat/shared';
import { useDismiss } from '../../ui/useDismiss';
import { STATUS_TONE } from './tones';

const COMPACT_QUERY = `(max-width: ${SHELL_WIDE_MIN_PX - 1}px), (max-height: ${SHELL_MIN_HEIGHT_PX - 1}px)`;
const matchesCompact = () => typeof window.matchMedia === 'function' && window.matchMedia(COMPACT_QUERY).matches;

/** A phone: the open service takes the screen and «Pendientes» lives in «Checklist» (José 19/11). */
export function useCompactShell(): boolean {
  const [compact, setCompact] = useState(matchesCompact);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(COMPACT_QUERY);
    const onChange = () => setCompact(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return compact;
}

/** Where a section puts its actions: at the right of the service's tab bar (design cc-03…cc-05). */
/** `undefined`: no shell around (inline); `null`: the shell's bar is not mounted yet. */
const ActionsSlot = createContext<HTMLElement | null | undefined>(undefined);

/** A section's buttons («Crear informe», «Subir», «Capas»…): in the tab bar when there is one, inline otherwise. */
export function SectionActions(props: { children: ReactNode }) {
  const slot = useContext(ActionsSlot);
  if (slot) return createPortal(props.children, slot);
  if (slot === null) return null;
  return <div className="flex flex-wrap items-center justify-end gap-2">{props.children}</div>;
}

export const SHELL_ACTION = 'flex h-10 shrink-0 items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3 text-[13px] font-semibold text-on-surface hover:bg-background';
export const SHELL_PRIMARY = 'flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-bold text-on-primary hover:bg-primary/90 disabled:opacity-60';
const KICKER = 'font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant';

const StatusChip = ({ service }: { service: SpaceClientService }) => (
  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[service.status]}`}>{CLIENT_SERVICE_STATUS_LABELS[service.status]}</span>
);

const Progress = ({ value, className }: { value?: number; className: string }) => (value === undefined ? null : (
  <span aria-hidden className={`block h-1.5 overflow-hidden rounded-full bg-surface-variant ${className}`}><span className="block h-full rounded-full bg-primary" style={{ width: `${value}%` }} /></span>
));

/** «⋯» of the head: what the service has outside Lilachat. Without it, no menu. */
function MoreMenu(props: { portalUrl?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(open, box, () => setOpen(false));
  if (!props.portalUrl) return null;
  return (
    <div ref={box} className="relative">
      <button type="button" data-testid="servicio-mas" aria-label="Más opciones" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-10 w-10 place-items-center rounded-xl border border-outline/20 bg-surface text-on-surface hover:bg-background"><MoreVertical size={18} /></button>
      {open ? (
        <div role="menu" className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-outline/15 bg-surface p-1.5 shadow-lg">
          <a role="menuitem" href={props.portalUrl} target="_blank" rel="noreferrer" data-testid="abrir-servicio-portal" onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold text-on-surface hover:bg-background"><ExternalLink size={15} /> Abrir en el Portal</a>
        </div>
      ) : null}
    </div>
  );
}

function TabBar(props: { tabs: ServiceTabItem[]; tab: ServiceTabKey; onTab: (tab: ServiceTabKey) => void; onSlot: (slot: HTMLElement | null) => void; compact: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 ${props.compact ? 'border-t border-outline/10 px-3' : ''}`}>
      <div role="tablist" className="flex max-w-full shrink-0 gap-5 overflow-x-auto">
        {props.tabs.map((one) => {
          const open = one.key === props.tab;
          return (
            <button key={one.key} type="button" role="tab" aria-selected={open} data-testid={`pestana-detalle-${one.key}`} onClick={() => props.onTab(one.key)} className={`flex h-11 shrink-0 items-center gap-1.5 border-b-2 text-[14px] ${open ? 'border-primary font-semibold text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
              {one.label}
              {one.count !== undefined ? <span className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${open ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>{one.count}</span> : null}
            </button>
          );
        })}
      </div>
      <div ref={props.onSlot} data-testid="acciones-seccion" className="ml-auto flex min-w-0 items-center justify-end gap-2 py-1.5" />
    </div>
  );
}

type HeadProps = { service: SpaceClientService; clientName?: string; onBack: () => void; onShare?: () => void; portalUrl?: string };

/** Tablet and computer (cc-02 desktop): «‹ Servicios», the kicker, the name with its state, its line and bar; link and «⋯» on the right. */
function WideHead(props: HeadProps) {
  const line = serviceHeadLine(props.service);
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" data-testid="volver-a-servicios" onClick={props.onBack} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg pr-2 text-[13px] font-semibold text-primary hover:bg-primary/5"><ChevronLeft size={16} /> Servicios</button>
          {props.clientName ? <p className={`min-w-0 truncate border-l border-outline/20 pl-2 ${KICKER}`}>{`Servicio · ${props.clientName}`}</p> : null}
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h2 data-testid="servicio-nombre" className="min-w-0 text-xl font-extrabold tracking-tight text-on-surface">{props.service.name}</h2>
          <StatusChip service={props.service} />
        </div>
        {line || props.service.progress !== undefined ? (
          <div className="mt-1 flex items-center gap-3 text-[13px] text-on-surface-variant">
            <span data-testid="servicio-linea" className="whitespace-nowrap">{line}</span>
            <Progress value={props.service.progress} className="w-40 min-w-16 shrink" />
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {props.onShare ? <button type="button" data-testid="enlace-servicio" onClick={props.onShare} className={SHELL_ACTION}><Link2 size={15} /> Enlace del servicio</button> : null}
        <MoreMenu portalUrl={props.portalUrl} />
      </div>
    </div>
  );
}

/** Phone (cc-02 mobile): the service takes the screen with its back arrow; state, line and bar under the name. */
function CompactHead(props: HeadProps) {
  const line = serviceHeadLine(props.service);
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" data-testid="volver-a-servicios" aria-label="Volver a Servicios" onClick={props.onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-outline/20 text-on-surface"><ArrowLeft size={18} /></button>
        <div className="min-w-0 flex-1">
          {props.clientName ? <p className={`truncate ${KICKER}`}>{props.clientName}</p> : null}
          <h2 data-testid="servicio-nombre" className="truncate text-[16px] font-extrabold text-on-surface">{props.service.name}</h2>
        </div>
        {props.onShare ? <button type="button" data-testid="enlace-servicio" aria-label="Enlace del servicio" onClick={props.onShare} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-outline/20 text-on-surface"><Link2 size={17} /></button> : null}
        <MoreMenu portalUrl={props.portalUrl} />
      </div>
      <div className="px-4 pb-2">
        <div className="flex min-w-0 items-center gap-2 text-[13px] text-on-surface-variant">
          <StatusChip service={props.service} />
          <span data-testid="servicio-linea" className="min-w-0 truncate">{line}</span>
        </div>
        <Progress value={props.service.progress} className="mt-2 w-full" />
      </div>
    </>
  );
}

export type ServiceShellProps = HeadProps & { compact: boolean; tabs: ServiceTabItem[]; tab: ServiceTabKey; onTab: (tab: ServiceTabKey) => void; /** The map draws edge to edge: no padding, no scroll of its own. */ flush?: boolean; children: ReactNode };

/**
 * An open service, the same in its four sections (José 19/11, designs cc-02…cc-05): the head and
 * ONE underlined bar Pedidos · Informes · Mapa · Drive, the section's actions at its right. No
 * crumbs: «‹ Servicios» on a tablet or computer, the back arrow on a phone.
 */
export function ServiceShellWeb(props: ServiceShellProps) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <div data-testid="detalle-servicio" className="flex min-h-0 flex-1 flex-col">
      <header data-testid="cabecera-servicio" className={`relative z-20 shrink-0 border-b border-outline/15 bg-surface ${props.compact ? '' : 'px-4 pt-4 md:px-6'}`}>
        {props.compact ? <CompactHead {...props} /> : <WideHead {...props} />}
        <div className={props.compact ? '' : 'mt-2'}><TabBar tabs={props.tabs} tab={props.tab} onTab={props.onTab} onSlot={setSlot} compact={props.compact} /></div>
      </header>
      <ActionsSlot.Provider value={slot}>
        {props.flush ? props.children : (
          <div className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
            <div className="mx-auto flex max-w-5xl flex-col gap-3">{props.children}</div>
          </div>
        )}
      </ActionsSlot.Provider>
    </div>
  );
}

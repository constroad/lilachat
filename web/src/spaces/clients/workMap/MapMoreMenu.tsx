import { useEffect, useRef, useState } from 'react';
import { ArchiveRestore, Download, ExternalLink, Layers, Maximize2, MoreHorizontal, MoreVertical, Paintbrush, Pencil, PenLine, Plus, Route, Share2, TrendingUp, type LucideIcon } from 'lucide-react';
import { mapMoreItems, type MapMoreKey, type MapScreenItem } from '@lilachat/shared';

const ICONS: Record<MapMoreKey, LucideIcon> = { share: Share2, screen: Maximize2, record: Pencil, avance: TrendingUp, croquis: PenLine, area: Route, draw: Plus, stages: Layers, works: Paintbrush, export: Download, open: ExternalLink, deleted: ArchiveRestore };
/** The test ids the buttons had before they moved under «Más»: the E2E and the tutorials keep them. */
const TEST_IDS: Record<MapMoreKey, string> = { share: 'mapa-compartir', screen: 'mapa-pantalla-completa', record: 'mapa-registrar-avance', avance: 'mapa-modo-avance', croquis: 'mapa-editar-croquis', area: 'mapa-marcar-calles', draw: 'mapa-nueva-calle', stages: 'mapa-etapas-abrir', works: 'mapa-trabajos-abrir', export: 'mapa-exportar', open: 'mapa-abrir', deleted: 'mapa-borrados-abrir' };
const ITEM = 'flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] font-semibold text-on-surface hover:bg-background';

/** Closes a popover on Escape or a press outside its holder. */
export function useDismiss(open: boolean, close: () => void) {
  const holder = useRef<HTMLDivElement>(null);
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: PointerEvent) => {
      if (!holder.current?.contains(event.target as Node)) latest.current();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
  return holder;
}

export type MoreActions = { pageUrl: string; onPick: (key: Exclude<MapMoreKey, 'open'>) => void; draws: boolean; edits: boolean; admin: boolean; className: string; /** «Compartir avance» first (José 20/11). */ share?: boolean; /** «Pantalla completa», or the way out. */ screen?: MapScreenItem; /** A round ⋮ over the map on a phone (design mapa-v2). */ round?: boolean; /** «Modo avance» and «Editar croquis» (José 28/11). */ fieldTools?: boolean; /** «Registrar avance» when no layer sheet carries it. */ record?: boolean };

/** «Más» (José 09/11): everything that is not «Registrar avance», in one list; José 20/11 moved «Compartir avance» and the full screen in. */
export function MapMoreMenu(props: MoreActions) {
  const [open, setOpen] = useState(false);
  const holder = useDismiss(open, () => setOpen(false));
  const items = mapMoreItems(props);
  return (
    <div ref={holder} className="relative">
      <button type="button" data-testid="mapa-mas" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((shown) => !shown)} aria-label={props.round ? 'Más opciones del mapa' : undefined} className={props.className}>{props.round ? <MoreVertical size={18} /> : <><MoreHorizontal size={16} /> Más</>}</button>
      {open ? (
        <div role="menu" data-testid="mapa-mas-menu" className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-outline/15 bg-surface p-1.5 shadow-lg">
          {items.map((item) => {
            const Icon = ICONS[item.key];
            const body = <><Icon size={16} className="shrink-0 text-on-surface-variant" />{item.label}</>;
            if (item.key === 'open') {
              return <a key={item.key} role="menuitem" data-testid={TEST_IDS.open} href={props.pageUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={ITEM}>{body}</a>;
            }
            const key = item.key;
            return <button key={key} type="button" role="menuitem" data-testid={TEST_IDS[key]} onClick={() => { setOpen(false); props.onPick(key); }} className={ITEM}>{body}</button>;
          })}
        </div>
      ) : null}
    </div>
  );
}

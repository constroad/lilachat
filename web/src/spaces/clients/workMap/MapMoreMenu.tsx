import { useEffect, useRef, useState } from 'react';
import { ArchiveRestore, Download, ExternalLink, Layers, MoreHorizontal, Paintbrush, Plus, type LucideIcon } from 'lucide-react';
import { mapMoreItems, type MapMoreKey } from '@lilachat/shared';

const ICONS: Record<MapMoreKey, LucideIcon> = { draw: Plus, stages: Layers, works: Paintbrush, export: Download, open: ExternalLink, deleted: ArchiveRestore };
/** The test ids the buttons had before they moved under «Más»: the E2E and the tutorials keep them. */
const TEST_IDS: Record<MapMoreKey, string> = { draw: 'mapa-nueva-calle', stages: 'mapa-etapas-abrir', works: 'mapa-trabajos-abrir', export: 'mapa-exportar', open: 'mapa-abrir', deleted: 'mapa-borrados-abrir' };
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

export type MoreActions = { pageUrl: string; onPick: (key: Exclude<MapMoreKey, 'open'>) => void; draws: boolean; edits: boolean; admin: boolean; className: string };

/** «Más» (José 09/11): everything that is not «Registrar avance» or «Compartir», in one list. */
export function MapMoreMenu(props: MoreActions) {
  const [open, setOpen] = useState(false);
  const holder = useDismiss(open, () => setOpen(false));
  const items = mapMoreItems(props);
  return (
    <div ref={holder} className="relative">
      <button type="button" data-testid="mapa-mas" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((shown) => !shown)} className={props.className}><MoreHorizontal size={16} /> Más</button>
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

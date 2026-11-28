import type { ReactNode } from 'react';
import { Layers, X } from 'lucide-react';
import { mapLegendEntries, type WorkMapView } from '@lilachat/shared';

/**
 * What floats over the map (José 20/11, design mapa-v2): on a computer one segmented group
 * «Capas | Editar croquis | Más»; on a phone a column of round buttons and small pills.
 */
export const MAP_ROUND = 'pointer-events-auto grid h-10 w-10 shrink-0 place-items-center rounded-full border border-outline/15 bg-surface text-on-surface shadow-md hover:bg-background';
export const MAP_SEGMENT = 'flex h-10 shrink-0 items-center gap-2 px-3 text-[13px] font-semibold text-on-surface hover:bg-background';
export const MAP_PILL = 'pointer-events-auto flex h-10 shrink-0 items-center gap-2 rounded-full border border-outline/15 bg-surface px-3.5 text-[13px] font-semibold text-on-surface shadow-md hover:bg-background';
const ON = 'border-primary/40 bg-primary/10 text-primary';

/**
 * «Capas»: on a computer a segment of the group; on a phone a floating pill with its word
 * (José 28/11: «Capas y leyenda» closed until this is pressed).
 */
export function LayersButton(props: { open: boolean; onToggle: () => void; round: boolean }) {
  if (props.round) return <button type="button" data-testid="mapa-capas-abrir" aria-label="Capas y leyenda" aria-pressed={props.open} onClick={props.onToggle} className={`${MAP_PILL} ${props.open ? ON : ''}`}><Layers size={16} /> Capas</button>;
  return <button type="button" data-testid="mapa-capas-abrir" aria-pressed={props.open} onClick={props.onToggle} className={`${MAP_SEGMENT} rounded-l-xl ${props.open ? 'bg-primary/10 text-primary' : ''}`}><Layers size={16} /> Capas</button>;
}

/** One group with dividers (design mapa-v2 desktop): the map's tools, no longer piled in the tab bar. */
export const MapToolGroup = (props: { children: ReactNode }) => (
  <div role="group" aria-label="Herramientas del mapa" data-testid="mapa-herramientas" className="pointer-events-auto flex shrink-0 items-center divide-x divide-outline/15 rounded-xl border border-outline/15 bg-surface shadow-md">{props.children}</div>
);

/** «Convenciones» floating at the foot of the map: each work, what is still to build, what waits. */
export function MapLegendCard(props: { view: WorkMapView; waiting: number }) {
  if (!props.view.works.length) return null;
  return (
    <div data-testid="mapa-leyenda" className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-outline/15 bg-surface px-3 py-2 text-[12px] shadow-md">
      {mapLegendEntries(props.view, props.waiting).map((entry) => (
        <span key={entry.key} className="flex items-center gap-1.5">
          {entry.kind === 'todo' ? <span aria-hidden className="w-4 border-t-2 border-dashed border-on-surface-variant/60" />
            : entry.kind === 'waiting' ? <span aria-hidden className="w-4 border-t-[3px] border-dashed border-on-surface/50" />
            : <span aria-hidden className="h-1 w-4 rounded-full" style={{ backgroundColor: entry.color ?? undefined }} />}
          <span className={entry.kind === 'work' ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}>{entry.label}</span>
        </span>
      ))}
    </div>
  );
}

/** The top of the phone's sheet: its handle and the way to close it, back to the map alone. */
export const SheetTop = (props: { onClose: () => void }) => (
  <div className="sticky top-0 z-10 flex items-center justify-between bg-surface px-4 pt-2">
    <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-outline/30" />
    <button type="button" data-testid="mapa-hoja-cerrar" aria-label="Cerrar el panel" onClick={props.onClose} className="absolute right-3 top-2 grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={16} /></button>
  </div>
);

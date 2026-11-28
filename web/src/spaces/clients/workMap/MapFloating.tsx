import type { ReactNode } from 'react';
import { Eye, X } from 'lucide-react';
import { mapLegendEntries, type WorkMapView } from '@lilachat/shared';

/**
 * What floats over the map (José 20/11, design mapa-v2): on a computer one segmented group
 * «Ver | Editar croquis | Más»; on a phone a column of round buttons and small pills.
 */
export const MAP_ROUND = 'pointer-events-auto grid h-10 w-10 shrink-0 place-items-center rounded-full border border-outline/15 bg-surface text-on-surface shadow-md hover:bg-background';
export const MAP_SEGMENT = 'flex h-10 shrink-0 items-center gap-2 px-3 text-[13px] font-semibold text-on-surface hover:bg-background';
export const MAP_PILL = 'pointer-events-auto flex h-10 shrink-0 items-center gap-2 rounded-full border border-outline/15 bg-surface px-3.5 text-[13px] font-semibold text-on-surface shadow-md hover:bg-background';
const ON = 'border-primary/40 bg-primary/10 text-primary';

/**
 * «Ver»: on a computer a segment of the group; on a phone a floating pill with the eye and its word
 * (José 28/11: closed until this is pressed).
 */
export function LayersButton(props: { open: boolean; onToggle: () => void; round: boolean }) {
  if (props.round) return <button type="button" data-testid="mapa-capas-abrir" aria-label="Ver" aria-pressed={props.open} onClick={props.onToggle} className={`${MAP_PILL} ${props.open ? ON : ''}`}><Eye size={16} /> Ver</button>;
  return <button type="button" data-testid="mapa-capas-abrir" aria-pressed={props.open} onClick={props.onToggle} className={`${MAP_SEGMENT} rounded-l-xl ${props.open ? 'bg-primary/10 text-primary' : ''}`}><Eye size={16} /> Ver</button>;
}

/** One group with dividers (design mapa-v2 desktop): the map's tools, no longer piled in the tab bar. */
export const MapToolGroup = (props: { children: ReactNode }) => (
  <div role="group" aria-label="Herramientas del mapa" data-testid="mapa-herramientas" className="pointer-events-auto flex shrink-0 items-center divide-x divide-outline/15 rounded-xl border border-outline/15 bg-surface shadow-md">{props.children}</div>
);

/** «Convenciones» floating at the foot of the map: each work and, in orange, what is still to build. */
export function MapLegendCard(props: { view: WorkMapView; /** Streets drawn with no work painted yet. */ defined?: number }) {
  const entries = mapLegendEntries(props.view, props.defined);
  if (!entries.length) return null;
  return (
    <div data-testid="mapa-leyenda" className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-outline/15 bg-surface px-3 py-2 text-[12px] shadow-md">
      {entries.map((entry) => (
        <span key={entry.key} className="flex items-center gap-1.5">
          <span aria-hidden data-testid={`mapa-leyenda-${entry.kind}`} className="h-1.5 w-4 rounded-full ring-1 ring-on-surface/40" style={{ backgroundColor: entry.color }} />
          <span className={entry.kind === 'work' ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}>{entry.label}</span>
        </span>
      ))}
    </div>
  );
}

/** The top of the phone's sheet: its handle (it grows the layer's sheet one step) and the X that folds it. */
export const SheetTop = (props: { onClose?: () => void; onGrow?: () => void }) => (
  <div className="sticky top-0 z-10 flex min-h-6 items-center justify-between bg-surface px-4 pt-2">
    {props.onGrow
      ? <button type="button" data-testid="mapa-hoja-asa" aria-label="Ver más del trabajo" onClick={props.onGrow} className="mx-auto grid h-6 w-16 place-items-center"><span aria-hidden className="h-1 w-10 rounded-full bg-outline/30" /></button>
      : <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-outline/30" />}
    {props.onClose ? <button type="button" data-testid="mapa-hoja-cerrar" aria-label="Plegar el panel" onClick={props.onClose} className="absolute right-3 top-2 grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={16} /></button> : null}
  </div>
);

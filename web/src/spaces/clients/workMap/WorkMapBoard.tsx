import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArchiveRestore, ExternalLink, Maximize2, Minimize2, Plus, Share2 } from 'lucide-react';
import { type MapEditSend, dischargePinsOf, stretchLinesOf, suggestDischarges, workMapStageGroups, workMapView, type UnitDischarge, type WorkMap, type WorkMapFilter, type StretchRange } from '@lilachat/shared';
import { WorkMapDischarges, type ProgressSend } from './WorkMapDischarges';
import { WorkMapExport } from './WorkMapExport';
import { MapFilters, MapLegend } from './WorkMapOverlays';
import { WorkMapPanel } from './WorkMapPanel';
import type { StreetDeleteSend } from './StreetDelete';
import { StreetScopes } from './StreetScopes';
import { DeletedWork } from './DeletedWork';

const WorkMapCanvas = lazy(() => import('./WorkMapCanvas'));

const ACTION = 'flex h-10 shrink-0 items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3 text-[13px] font-semibold text-on-surface hover:bg-background';
/** Under this width the panel goes under the map, as the design's phone (o-01 mobile). */
const WIDE_MIN_PX = 880;
/** The bar over the map: crumbs and tabs on the left, the actions on the right (o-01). */
export const MAP_HEAD_BAR = 'flex shrink-0 items-start gap-3 border-b border-outline/15 bg-surface px-4 pt-3 md:px-6';

/** Wide or narrow by the board's own width: the chat list beside it decides more than the window. */
function useWide(holder: RefObject<HTMLElement | null>): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const element = holder.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWide((entry?.contentRect.width ?? 0) >= WIDE_MIN_PX));
    observer.observe(element);
    return () => observer.disconnect();
  }, [holder]);
  return wide;
}

/** The browser's full screen when it allows it; the layer over the page stands either way. */
function useFullScreen() {
  const holder = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    const followBrowser = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('fullscreenchange', followBrowser);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('fullscreenchange', followBrowser);
    };
  }, [expanded]);
  const open = () => {
    setExpanded(true);
    holder.current?.requestFullscreen?.().catch((failure: Error) => console.warn('work map: full screen refused', failure.name));
  };
  const close = () => {
    setExpanded(false);
    if (document.fullscreenElement) void document.exitFullscreen();
  };
  return { holder, expanded, open, close };
}

const NO_DISCHARGES: UnitDischarge[] = [];

/** The units of the Control de pista over the map: the suggestion, its pins and the stretches being confirmed. */
function useDischarges(map: WorkMap, discharges: UnitDischarge[]) {
  const suggestion = useMemo(() => suggestDischarges(map, discharges), [map, discharges]);
  const [ranges, setRanges] = useState<Record<string, StretchRange>>({});
  const pins = useMemo(() => dischargePinsOf(suggestion), [suggestion]);
  const stretches = useMemo(() => stretchLinesOf(map, suggestion.stretches, ranges), [map, suggestion, ranges]);
  const onRange = (streetId: string, range: StretchRange) => setRanges((before) => ({ ...before, [streetId]: range }));
  return { suggestion, ranges, onRange, pins, stretches };
}

type BoardProps = { map: WorkMap; pageUrl: string; title: string; serviceId: string; /** Crumbs and title (o-01). */ head?: ReactNode; /** The service's tabs: beside the actions on a wide board, on their own row on a narrow one. */ tabs?: ReactNode; /** The service's state beside «Avance de la obra». */ badge?: ReactNode; discharges?: UnitDischarge[]; send?: ProgressSend; /** «Nueva calle» (o-02). */ onDraw?: () => void; /** «Borrar calle»: anyone, logical (José 07/11). */ deleteStreet?: StreetDeleteSend; /** Stretches, stages and works (o-03 to o-05). */ editMap?: MapEditSend; /** A space admin: «Borrados» and «Restaurar» (José 07/11). */ admin?: boolean };

function Actions(props: { pageUrl: string; expanded: boolean; wide: boolean; onToggle: () => void; onExport: () => void; onDraw?: () => void; onDeleted?: () => void }) {
  const label = (text: string) => (props.wide ? text : <span className="sr-only">{text}</span>);
  return (
    <div className={`flex shrink-0 items-center gap-2 ${props.wide ? 'pb-3' : 'pb-2'}`}>
      <button type="button" data-testid="mapa-pantalla-completa" onClick={props.onToggle} className={ACTION}>
        {props.expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {label(props.expanded ? 'Salir' : 'Pantalla completa')}
      </button>
      {props.onDraw ? <button type="button" data-testid="mapa-nueva-calle" onClick={props.onDraw} className={ACTION}><Plus size={16} /> {label('Nueva calle')}</button> : null}
      {props.onDeleted ? <button type="button" data-testid="mapa-borrados-abrir" onClick={props.onDeleted} className={ACTION}><ArchiveRestore size={16} /> {label('Borrados')}</button> : null}
      <a data-testid="mapa-abrir" href={props.pageUrl} target="_blank" rel="noopener noreferrer" className={ACTION}><ExternalLink size={16} /> {label('Portal')}</a>
      <button type="button" data-testid="mapa-exportar" onClick={props.onExport} className={`${ACTION} border-primary bg-primary text-on-primary hover:bg-primary/90`}><Share2 size={16} /> {props.wide ? 'Compartir avance' : 'Compartir'}</button>
    </div>
  );
}

/**
 * The map of the work as the design draws it (`o-01-mapa-obra`): the bar with the service's tabs,
 * the literal map with its filters floating, and the panel of progress on the right; on a narrow
 * screen the panel goes under the map. «Compartir avance» opens the export in that panel (`o-12`).
 */
export function WorkMapBoard(props: BoardProps) {
  const { map, pageUrl } = props;
  const [filter, setFilter] = useState<WorkMapFilter>({});
  const [exporting, setExporting] = useState(false);
  const [streetId, setStreetId] = useState<string | null>(null);
  const [seeingDeleted, setSeeingDeleted] = useState(false);
  const view = useMemo(() => workMapView(map, filter), [map, filter]);
  const groups = useMemo(() => workMapStageGroups(map, view), [map, view]);
  const pista = useDischarges(map, props.discharges ?? NO_DISCHARGES);
  const { holder, expanded, open, close } = useFullScreen();
  const wide = useWide(holder);
  const top = pista.suggestion.units.length ? <WorkMapDischarges map={map} serviceId={props.serviceId} suggestion={pista.suggestion} send={props.send} ranges={pista.ranges} onRange={pista.onRange} /> : null;
  const streetPanel = streetId ? <StreetScopes map={map} streetId={streetId} send={props.editMap} onBack={() => setStreetId(null)} /> : null;
  const deletedPanel = seeingDeleted && props.editMap ? <DeletedWork map={map} send={props.editMap} onClose={() => setSeeingDeleted(false)} /> : null;
  const panel = deletedPanel ?? (exporting
    ? <WorkMapExport map={map} filter={filter} title={props.title} pageUrl={pageUrl} onClose={() => setExporting(false)} />
    : streetPanel ?? <WorkMapPanel view={view} groups={groups} filter={filter} badge={props.badge} top={top} scrolls={wide} deleteStreet={props.deleteStreet} onOpenStreet={setStreetId} />);
  return (
    <div ref={holder} data-testid="mapa-servicio" data-expanded={expanded} data-wide={wide} className={`flex flex-col bg-background ${expanded ? 'fixed inset-0 z-50' : 'min-h-0 flex-1'} ${wide ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      <header className={`${MAP_HEAD_BAR} flex-wrap`}>
        <div className="min-w-0 flex-1">{props.head}{wide ? props.tabs : null}</div>
        <Actions pageUrl={pageUrl} expanded={expanded} wide={wide} onToggle={expanded ? close : open} onExport={() => setExporting((shown) => !shown)} onDraw={props.onDraw} onDeleted={props.admin && props.editMap ? () => setSeeingDeleted((shown) => !shown) : undefined} />
        {wide ? null : <div className="-mt-2 min-w-0 basis-full">{props.tabs}</div>}
      </header>
      {wide ? null : <MapFilters map={map} view={view} filter={filter} onFilter={setFilter} floating={false} />}
      <div className={wide ? 'flex min-h-0 flex-1' : 'flex flex-col'}>
        <div className={`relative overflow-hidden bg-surface-variant ${wide ? 'min-w-0 flex-1' : 'h-[58vh] min-h-[320px] shrink-0'}`}>
          <Suspense fallback={<div data-testid="mapa-cargando-lienzo" className="absolute inset-0 animate-pulse bg-surface-variant" />}>
            <WorkMapCanvas view={view} expanded={expanded} pins={pista.pins} stretches={pista.stretches} />
          </Suspense>
          {wide ? <MapFilters map={map} view={view} filter={filter} onFilter={setFilter} floating /> : null}
          <MapLegend view={view} compact={!wide} />
        </div>
        <aside className={wide ? 'flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-outline/15 bg-surface xl:w-[400px]' : 'relative z-10 -mt-5 flex flex-col overflow-hidden rounded-t-3xl border-t border-outline/15 bg-surface shadow-[0_-8px_24px_rgb(0_0_0/0.08)]'}>
          {wide ? null : <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-outline/30" />}
          {panel}
        </aside>
      </div>
    </div>
  );
}

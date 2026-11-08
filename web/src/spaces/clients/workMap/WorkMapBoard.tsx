import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { lazyChunk } from '../../../ui/lazyChunk';
import { ArchiveRestore, ChevronRight, Download, ExternalLink, Layers, Maximize2, Minimize2, Paintbrush, Plus, Share2, TrendingUp, Undo2, X } from 'lucide-react';
import { bareLinesOf, visibleStationMarks, brushLinesOf, brushTitle, progressTargetOf, type Brush, type ProgressTarget, type ManualPhotoUpload, type MapEditSend, type TraceUpload, type ServiceMapInReport, dischargePinsOf, stretchLinesOf, suggestDischarges, workMapStageGroups, workMapView, type UnitDischarge, type WorkMap, type WorkMapFilter, type StretchRange, type MapPhoto } from '@lilachat/shared';
import { WorkMapDischarges, type ProgressSend } from './WorkMapDischarges';
import { WorkMapExport } from './WorkMapExport';
import { ShareProgress } from './ShareProgress';
import { MapFilters, MapLegend } from './WorkMapOverlays';
import { WorkMapPanel } from './WorkMapPanel';
import type { StreetDeleteSend } from './StreetDelete';
import { StreetScopes } from './StreetScopes';
import { DeletedWork } from './DeletedWork';
import { useBrush, WorkLayers, type LayersKind } from './WorkLayers';
import { PhotoToggle, usePhotoLayer } from './MapPhotos';

const WorkMapCanvas = lazyChunk(() => import('./WorkMapCanvas'));

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

type BoardProps = { map: WorkMap; pageUrl: string; title: string; serviceId: string; /** Crumbs and title (o-01). */ head?: ReactNode; /** The service's tabs: beside the actions on a wide board, on their own row on a narrow one. */ tabs?: ReactNode; /** The service's state beside «Avance de la obra». */ badge?: ReactNode; discharges?: UnitDischarge[]; /** Field photos with their place: the «Fotos» layer (José 08/11). */ mapPhotos?: MapPhoto[]; send?: ProgressSend; /** «Nueva calle» (o-02). */ onDraw?: () => void; /** «Borrar calle»: anyone, logical (José 07/11). */ deleteStreet?: StreetDeleteSend; /** Stretches, stages and works (o-03 to o-05). */ editMap?: MapEditSend; /** A space admin: «Borrados» and «Restaurar» (José 07/11). */ admin?: boolean; /** Photos of «Registrar avance» (o-06). */ uploadPhoto?: ManualPhotoUpload<File>; /** KMZ or KML for «Importar» (o-12). */ uploadTrace?: TraceUpload<File>; /** «Incluir en el informe» as Portal has it. */ mapInReport?: ServiceMapInReport; /** What the last save answered, over the map. */ notice?: string | null };

/** «¿En qué calle?» when «Registrar avance» could go to several streets. */
function StreetPick(props: { streets: Array<{ id: string; name: string }>; onPick: (streetId: string) => void; onClose: () => void }) {
  return (
    <div data-testid="avance-elegir-calle" className="min-h-0 flex-1 overflow-y-auto bg-surface p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Registrar avance</p>
          <p className="mt-1 text-xl font-extrabold text-on-surface">¿En qué calle?</p>
        </div>
        <button type="button" aria-label="Cerrar" onClick={props.onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline/20 text-on-surface"><X size={16} /></button>
      </div>
      <ul className="mt-4 space-y-2">
        {props.streets.map((street) => <li key={street.id}><button type="button" data-testid={`avance-calle-${street.id}`} onClick={() => props.onPick(street.id)} className="flex h-12 w-full items-center justify-between rounded-xl border border-outline/20 px-4 text-left text-[14px] font-semibold text-on-surface hover:bg-background">{street.name}<ChevronRight size={16} /></button></li>)}
      </ul>
    </div>
  );
}

function Actions(props: { pageUrl: string; expanded: boolean; wide: boolean; onToggle: () => void; onExport: () => void; onShare: () => void; onRecord?: () => void; onDraw?: () => void; onDeleted?: () => void; onLayers?: (kind: LayersKind) => void }) {
  const label = (text: string) => (props.wide ? text : <span className="sr-only">{text}</span>);
  /** Secondary actions stay an icon with its name (design o-01): the bar keeps room for the crumbs and tabs. */
  const quiet = (text: string) => <span className="sr-only">{text}</span>;
  return (
    <div className={`flex shrink-0 items-center gap-2 ${props.wide ? 'pb-3' : 'pb-2'}`}>
      <button type="button" data-testid="mapa-pantalla-completa" title={props.expanded ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={props.onToggle} className={ACTION}>
        {props.expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {quiet(props.expanded ? 'Salir de pantalla completa' : 'Pantalla completa')}
      </button>
      {props.onDraw ? <button type="button" data-testid="mapa-nueva-calle" onClick={props.onDraw} className={ACTION}><Plus size={16} /> {label('Nueva calle')}</button> : null}
      {props.onLayers ? <button type="button" data-testid="mapa-etapas-abrir" title="Etapas" onClick={() => props.onLayers?.('stages')} className={ACTION}><Layers size={16} /> {label('Etapas')}</button> : null}
      {props.onLayers ? <button type="button" data-testid="mapa-trabajos-abrir" title="Trabajos" onClick={() => props.onLayers?.('works')} className={ACTION}><Paintbrush size={16} /> {label('Trabajos')}</button> : null}
      {props.onDeleted ? <button type="button" data-testid="mapa-borrados-abrir" title="Borrados" onClick={props.onDeleted} className={ACTION}><ArchiveRestore size={16} /> {quiet('Borrados')}</button> : null}
      <a data-testid="mapa-abrir" title="Abrir en Portal" href={props.pageUrl} target="_blank" rel="noopener noreferrer" className={ACTION}><ExternalLink size={16} /> {quiet('Abrir en Portal')}</a>
      <button type="button" data-testid="mapa-exportar" onClick={props.onExport} className={ACTION}><Download size={16} /> {label('Exportar')}</button>
      <button type="button" data-testid="mapa-compartir" onClick={props.onShare} className={ACTION}><Share2 size={16} /> {props.wide ? 'Compartir avance' : 'Compartir'}</button>
      {props.onRecord ? <button type="button" data-testid="mapa-registrar-avance" onClick={props.onRecord} className={`${ACTION} border-primary bg-primary text-on-primary hover:bg-primary/90`}><TrendingUp size={16} /> {props.wide ? 'Registrar avance' : 'Registrar'}</button> : null}
    </div>
  );
}

/** The band over the map while the brush is on (o-04, o-05): what is painted, «Deshacer» and «Listo». */
function BrushBand(props: { title: string; error: string | null; busy: boolean; canUndo: boolean; onUndo: () => void; onDone: () => void }) {
  return (
    <div data-testid="mapa-brocha" className="absolute inset-x-3 top-3 z-10 rounded-xl border border-primary/30 bg-surface/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
        <Paintbrush size={16} className="shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-[13px] font-semibold text-on-surface">{props.busy ? 'Guardando…' : props.title}</p>
        <button type="button" data-testid="brocha-deshacer" disabled={!props.canUndo || props.busy} onClick={props.onUndo} className="flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-primary disabled:opacity-40"><Undo2 size={14} />Deshacer</button>
        <button type="button" data-testid="brocha-listo" onClick={props.onDone} className="h-9 rounded-lg bg-primary px-3 text-[13px] font-semibold text-on-primary">Listo</button>
      </div>
      {props.error ? <p role="alert" data-testid="brocha-error" className="mt-1.5 text-[12px] font-semibold text-error">{props.error}</p> : null}
    </div>
  );
}

const NO_BRUSH_LINES: ReturnType<typeof brushLinesOf> = [];
const linesFor = (map: WorkMap, brush: Brush | null) => (brush ? brushLinesOf(map, brush) : NO_BRUSH_LINES);

/**
 * The map of the work as the design draws it (`o-01-mapa-obra`): the bar with the service's tabs,
 * the literal map with its filters floating, and the panel of progress on the right; on a narrow
 * screen the panel goes under the map. «Compartir avance» opens the export in that panel (`o-12`).
 */
export function WorkMapBoard(props: BoardProps) {
  const { map, pageUrl } = props;
  const [filter, setFilter] = useState<WorkMapFilter>({});
  const [side, setSide] = useState<'export' | 'share' | null>(null);
  const toggleSide = (next: 'export' | 'share') => setSide((shown) => (shown === next ? null : next));
  const [streetId, setStreetId] = useState<string | null>(null);
  const [seeingDeleted, setSeeingDeleted] = useState(false);
  const [layers, setLayers] = useState<LayersKind | null>(null);
  const brushing = useBrush(map, props.editMap);
  const brushLines = useMemo(() => linesFor(map, brushing.brush), [map, brushing.brush]);
  const closeLayers = () => { setLayers(null); brushing.setBrush(null); };
  const [recordingStart, setRecordingStart] = useState(false);
  const [choosing, setChoosing] = useState<ProgressTarget | null>(null);
  const target = useMemo(() => progressTargetOf(map), [map]);
  const openStreet = (id: string | null, record = false) => { setChoosing(null); setRecordingStart(record); setStreetId(id); };
  const record = () => (target.kind === 'street' ? openStreet(target.streetId, true) : setChoosing(target));
  const view = useMemo(() => workMapView(map, filter), [map, filter]);
  const groups = useMemo(() => workMapStageGroups(map, view), [map, view]);
  const stations = useMemo(() => visibleStationMarks(map.streets, view.streets.map((street) => street.id)), [map, view]);
  const bare = useMemo(() => bareLinesOf({ streets: map.streets.filter((street) => view.streets.some((shown) => shown.id === street.id)), scopes: map.scopes }), [map, view]);
  const pista = useDischarges(map, props.discharges ?? NO_DISCHARGES);
  const photoLayer = usePhotoLayer(map, props.mapPhotos);
  const { holder, expanded, open, close } = useFullScreen();
  const wide = useWide(holder);
  const top = pista.suggestion.units.length ? <WorkMapDischarges map={map} serviceId={props.serviceId} suggestion={pista.suggestion} send={props.send} ranges={pista.ranges} onRange={pista.onRange} /> : null;
  const streetPanel = streetId ? <StreetScopes key={`${streetId}|${recordingStart}`} map={map} streetId={streetId} send={props.editMap} uploadPhoto={props.uploadPhoto} startRecording={recordingStart} onBack={() => openStreet(null)} /> : null;
  const pickPanel = choosing?.kind === 'choose' ? <StreetPick streets={choosing.streets} onPick={(id) => openStreet(id, true)} onClose={() => setChoosing(null)} /> : null;
  const deletedPanel = seeingDeleted && props.editMap ? <DeletedWork map={map} send={props.editMap} onClose={() => setSeeingDeleted(false)} /> : null;
  const sidePanel = side === 'export'
    ? <WorkMapExport map={map} filter={filter} onFilter={setFilter} title={props.title} pageUrl={pageUrl} send={props.editMap} uploadTrace={props.uploadTrace} onClose={() => setSide(null)} />
    : side === 'share' ? <ShareProgress map={map} filter={filter} onFilter={setFilter} send={props.editMap} mapInReport={props.mapInReport} onClose={() => setSide(null)} /> : null;
  const layersPanel = layers && props.editMap ? <WorkLayers map={map} kind={layers} send={props.editMap} brush={brushing.brush} onBrush={brushing.setBrush} onClose={closeLayers} /> : null;
  const panel = deletedPanel ?? layersPanel ?? sidePanel ?? pickPanel ?? (streetPanel ?? <WorkMapPanel view={view} groups={groups} filter={filter} badge={props.badge} top={top} scrolls={wide} deleteStreet={props.deleteStreet} onOpenStreet={(id) => openStreet(id)} />);
  return (
    <div ref={holder} data-testid="mapa-servicio" data-expanded={expanded} data-wide={wide} className={`flex flex-col bg-background ${expanded ? 'fixed inset-0 z-50' : 'min-h-0 flex-1'} ${wide ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      <header className={`${MAP_HEAD_BAR} flex-wrap`}>
        <div className="min-w-0 flex-1">{props.head}{wide ? props.tabs : null}</div>
        <Actions pageUrl={pageUrl} expanded={expanded} wide={wide} onToggle={expanded ? close : open} onExport={() => toggleSide('export')} onShare={() => toggleSide('share')} onRecord={props.editMap && target.kind !== 'none' ? () => { setSide(null); record(); } : undefined} onDraw={props.onDraw} onDeleted={props.admin && props.editMap ? () => setSeeingDeleted((shown) => !shown) : undefined} onLayers={props.editMap ? (kind) => { setSide(null); brushing.setBrush(null); setLayers((shown) => (shown === kind ? null : kind)); } : undefined} />
        {wide ? null : <div className="-mt-2 min-w-0 basis-full">{props.tabs}</div>}
      </header>
      {wide ? null : <MapFilters map={map} view={view} filter={filter} onFilter={setFilter} floating={false} />}
      {wide ? null : <MapLegend view={view} compact />}
      {props.notice ? <p role="status" data-testid="mapa-aviso" className="mx-4 mb-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[13px] font-semibold text-on-surface">{props.notice}</p> : null}
      <div className={wide ? 'flex min-h-0 flex-1' : 'flex flex-col'}>
        <div className={`relative overflow-hidden bg-surface-variant ${wide ? 'min-w-0 flex-1' : 'h-[58vh] min-h-[320px] shrink-0'}`}>
          <Suspense fallback={<div data-testid="mapa-cargando-lienzo" className="absolute inset-0 animate-pulse bg-surface-variant" />}>
            <WorkMapCanvas view={view} expanded={expanded} stations={stations} bare={bare} pins={photoLayer.shown ? photoLayer.pins : pista.pins} onPin={photoLayer.shown ? photoLayer.openPin : undefined} stretches={brushing.brush ? brushLines : pista.stretches} onTap={brushing.brush ? (place) => void brushing.tap(place) : undefined} />
          </Suspense>
          {photoLayer.available && !brushing.brush ? <PhotoToggle shown={photoLayer.shown} count={photoLayer.count} onToggle={photoLayer.toggle} /> : null}
          {wide && !brushing.brush ? <MapFilters map={map} view={view} filter={filter} onFilter={setFilter} floating /> : null}
          {brushing.brush ? <BrushBand title={brushTitle(map, brushing.brush)} error={brushing.error} busy={brushing.busy} canUndo={brushing.canUndo} onUndo={() => void brushing.undo()} onDone={() => brushing.setBrush(null)} /> : null}
          {wide ? <MapLegend view={view} compact={false} /> : null}
        </div>
        <aside className={wide ? 'flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-outline/15 bg-surface xl:w-[400px]' : 'relative z-10 -mt-5 flex flex-col overflow-hidden rounded-t-3xl border-t border-outline/15 bg-surface shadow-[0_-8px_24px_rgb(0_0_0/0.08)]'}>
          {wide ? null : <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-outline/30" />}
          {panel}
        </aside>
      </div>
      {photoLayer.viewer}
    </div>
  );
}

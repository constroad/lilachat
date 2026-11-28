import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { lazyChunk } from '../../../ui/lazyChunk';
import { Paintbrush, Route, TrendingUp, Undo2, X } from 'lucide-react';
import { activeLayerOf, limaDayKey, workMapWorkFilter, viewWithLayers, visibleMarks, visibleObservations, mapCardOf, mapPickAnchor, type MapPick, type WorkMapPoint, bareLinesOf, visibleStationMarks, brushLinesOf, brushTitle, progressTargetOf, type Brush, type ManualPhotoUpload, type MapEditSend, type TraceUpload, type ServiceMapInReport, unitPinsOfDay, withMediaBounds, pendingLinesOf, byApproveLinesOf, pendingCountOf, undoableOf, withPendingOf, showsUnitPins, type DischargePin, type PendingProgress, type MapMoreKey, stretchLinesOf, suggestDischarges, workMapStageGroups, workMapView, type UnitDischarge, type WorkMap, type WorkMapFilter, type StretchRange, type MapPhoto, type ManualProgressDraft } from '@lilachat/shared';
import { WorkMapDischarges, type ProgressSend } from './WorkMapDischarges';
import { WorkMapExport } from './WorkMapExport';
import { ShareProgress } from './ShareProgress';
import { MapFilters } from './WorkMapOverlays';
import { MapLayersPanel, useMapLayers } from './MapLayersPanel';
import { LayersButton, LegendButton, MAP_PILL, MAP_PILL_PRIMARY, MAP_ROUND, MAP_SEGMENT, MapLegendCard, MapToolGroup, SheetTop } from './MapFloating';
import { WorkMapPanel } from './WorkMapPanel';
import type { StreetDeleteSend } from './StreetDelete';
import { StreetScopes } from './StreetScopes';
import { DeletedWork } from './DeletedWork';
import { useBrush, WorkLayers, type LayersKind } from './WorkLayers';
import { usePhotoLayer } from './MapPhotos';
import { MapDayChips, useMapDays } from './MapDays';
import { PrimeCoatSuggestions } from './PrimeCoat';
import { PendingProgressCard, useByApprove } from './PendingProgress';
import { ProgressFeed } from './ProgressFeed';
import { ManualProgress } from './ManualProgress';
import { MapMoreMenu } from './MapMoreMenu';
import { usePortalFileViewer } from '../PortalFileViewer';
import { WorkMapItems, type LiftRow } from './WorkMapItems';
import { MapCardView } from './MapCardView';
import { AvanceTop, useAvanceMode } from './AvanceMode';
import { NewLayer } from './NewLayer';
import { AvancePanel } from './AvancePanel';
import { ServiceCroquisButton } from './ServiceCroquis';
import { LayerChips } from './LayerChips';
import { LayerSheet } from './LayerSheet';

const WorkMapCanvas = lazyChunk(() => import('./WorkMapCanvas'));

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
const NO_MAP_PHOTOS: MapPhoto[] = [];
const NO_UNIT_PINS: DischargePin[] = [];

/** The units of the Control de pista over the map: the suggestion, its pins and the stretches being confirmed. */
function useDischarges(map: WorkMap, discharges: UnitDischarge[], day: string, days: string[]) {
  const suggestion = useMemo(() => suggestDischarges(map, discharges), [map, discharges]);
  const [ranges, setRanges] = useState<Record<string, StretchRange>>({});
  // The chosen day's units, numbered inside their day and ringed with its color (José 09/11).
  const pins = useMemo(() => unitPinsOfDay(suggestion, discharges, day, days), [suggestion, discharges, day, days]);
  const stretches = useMemo(() => stretchLinesOf(map, suggestion.stretches, ranges), [map, suggestion, ranges]);
  const onRange = (streetId: string, range: StretchRange) => setRanges((before) => ({ ...before, [streetId]: range }));
  return { suggestion, ranges, onRange, pins, stretches };
}

type BoardProps = { /** «Levantar» on an open observation (José 27/11). */ onLift?: (row: LiftRow) => void; map: WorkMap; pageUrl: string; title: string; serviceId: string; /** Crumbs and title (o-01). */ head?: ReactNode; /** The service's state beside «Avance de la obra». */ badge?: ReactNode; discharges?: UnitDischarge[]; /** Field photos with their place: the «Fotos» layer (José 08/11). */ mapPhotos?: MapPhoto[]; send?: ProgressSend; /** «Nueva calle» (o-02). */ onDraw?: () => void; /** «Borrar calle»: anyone, logical (José 07/11). */ deleteStreet?: StreetDeleteSend; /** Stretches, stages and works (o-03 to o-05). */ editMap?: MapEditSend; /** A space admin: «Borrados» and «Restaurar» (José 07/11). */ admin?: boolean; /** Photos of «Registrar avance» (o-06). */ uploadPhoto?: ManualPhotoUpload<File>; /** KMZ or KML for «Importar» (o-12). */ uploadTrace?: TraceUpload<File>; /** «Incluir en el informe» as Portal has it. */ mapInReport?: ServiceMapInReport; /** What the last save answered, over the map. */ notice?: string | null; /** Reads the map again (after «Editar croquis»). */ reload?: () => void };

type ToolProps = { pageUrl: string; expanded: boolean; /** «Capas» opens or folds «Capas y leyenda» (design cc-04). */ layersOpen: boolean; onLayersPanel: () => void; onPick: (key: Exclude<MapMoreKey, 'open'>) => void; draws: boolean; edits: boolean; admin: boolean; onRecord?: () => void; /** «Avance» (design av-01): only who can edit the map. */ onAvance?: () => void; /** «Editar croquis» (José 19/11), drawn with the class it is given. */ croquis?: (className: string) => ReactNode };

/** «Más» with «Compartir avance» and the full screen inside (José 20/11, design mapa-v2). */
const More = (props: ToolProps & { round: boolean; className: string }) => (
  <MapMoreMenu pageUrl={props.pageUrl} onPick={props.onPick} draws={props.draws} edits={props.edits} admin={props.admin} share screen={props.expanded ? 'close' : 'open'} round={props.round} className={props.className} />
);

/** «Registrar avance», the field engineer's action, beside the tools (o-01). */
const RecordButton = (props: { onRecord?: () => void; label: string; className: string }) => (props.onRecord
  ? <button type="button" data-testid="mapa-registrar-avance" onClick={props.onRecord} className={props.className}><TrendingUp size={16} /> {props.label}</button>
  : null);

/** «Avance» (design av-01): the mode that marks how far each work went, street by street. */
const AvanceButton = (props: { onAvance?: () => void }) => (props.onAvance
  ? <button type="button" data-testid="mapa-modo-avance" onClick={props.onAvance} className={`${MAP_PILL} border-primary/40 text-primary`}><Route size={16} /> Avance</button>
  : null);

/** A computer (design mapa-v2 desktop): one segmented group «Capas | Editar croquis | Más» over the map. */
function WideTools(props: ToolProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <MapToolGroup>
        <LayersButton open={props.layersOpen} onToggle={props.onLayersPanel} round={false} />
        {props.croquis?.(MAP_SEGMENT)}
        <More {...props} round={false} className={`${MAP_SEGMENT} rounded-r-xl`} />
      </MapToolGroup>
      <AvanceButton onAvance={props.onAvance} />
      <RecordButton onRecord={props.onRecord} label="Registrar avance" className={MAP_PILL_PRIMARY} />
    </div>
  );
}

/** A phone (design mapa-v2 mobile): round buttons down the right side of the map. */
function NarrowRail(props: ToolProps & { legend: boolean; legendOpen: boolean; onLegend: () => void }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <LayersButton open={props.layersOpen} onToggle={props.onLayersPanel} round />
      {props.legend ? <LegendButton open={props.legendOpen} onToggle={props.onLegend} /> : null}
      <More {...props} round className={MAP_ROUND} />
    </div>
  );
}

/** A phone: «Editar croquis» small and «Registrar» at the foot of the map, the legend over them; raised over the map attribution («© OpenMapTiles», E2E 20/11). */
function NarrowFoot(props: ToolProps & { legend: ReactNode }) {
  return (
    <div className="pointer-events-none absolute bottom-8 left-3 right-16 z-10 flex flex-col items-start gap-2">
      {props.legend}
      <div className="flex flex-wrap gap-2">
        {props.croquis?.(MAP_PILL)}
        <AvanceButton onAvance={props.onAvance} />
        <RecordButton onRecord={props.onRecord} label="Registrar" className={MAP_PILL_PRIMARY} />
      </div>
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

const NO_MARKS: NonNullable<WorkMap['marks']> = [];
const NO_OBSERVATIONS: NonNullable<WorkMap['observations']> = [];

/**
 * The card picked on the map or in the panel's lists (José 19/11): a pick from the list flies the
 * map there; an observation with no place shows its card in the panel instead.
 */
function useMapPick(map: WorkMap, onLift?: (row: LiftRow) => void) {
  const [selected, setSelected] = useState<MapPick | null>(null);
  const [focus, setFocus] = useState<WorkMapPoint | null>(null);
  const viewer = usePortalFileViewer();
  const [marks, observations] = [map.marks ?? NO_MARKS, map.observations ?? NO_OBSERVATIONS];
  const pickFromList = (pick: MapPick) => {
    setSelected(pick);
    const anchor = mapPickAnchor(pick, marks, observations);
    if (anchor) setFocus({ ...anchor });
  };
  const unplaced = selected && !mapPickAnchor(selected, marks, observations) ? mapCardOf(selected, marks, observations) : null;
  const inline = unplaced ? <div className="pt-4"><MapCardView card={unplaced} onClose={() => setSelected(null)} onPhoto={(photo, all) => viewer.open(photo, all)} /></div> : null;
  const items = marks.length || observations.length ? <>{inline}<WorkMapItems map={map} onPick={pickFromList} onLift={onLift} /></> : null;
  return { selected, setSelected, focus, items, openPhoto: viewer.open, viewer: viewer.viewer };
}

const NO_BRUSH_LINES: ReturnType<typeof brushLinesOf> = [];
const linesFor = (map: WorkMap, brush: Brush | null) => (brush ? brushLinesOf(map, brush) : NO_BRUSH_LINES);

/**
 * The map of the work as the design draws it (`o-01-mapa-obra`): the bar with the service's tabs,
 * the literal map with its filters floating, and the panel of progress on the right; on a narrow
 * screen the panel goes under the map. «Compartir avance» opens the export in that panel (`o-12`).
 */
export function WorkMapBoard(props: BoardProps) {
  const { pageUrl } = props;
  // José 28/11: what waits for approval comes with the map; «desde» skips it. Without the list, today's map.
  const byApprove = useByApprove(props.editMap, props.map);
  const map = useMemo(() => withPendingOf(props.map, byApprove.list), [props.map, byApprove.list]);
  const [filter, setFilter] = useState<WorkMapFilter>({});
  const [side, setSide] = useState<'export' | 'share' | null>(null);
  const toggleSide = (next: 'export' | 'share') => setSide((shown) => (shown === next ? null : next));
  const [streetId, setStreetId] = useState<string | null>(null);
  const [seeingDeleted, setSeeingDeleted] = useState(false);
  const [layers, setLayers] = useState<LayersKind | null>(null);
  const brushing = useBrush(map, props.editMap);
  const brushLines = useMemo(() => linesFor(map, brushing.brush), [map, brushing.brush]);
  const closeLayers = () => { setLayers(null); brushing.setBrush(null); };
  const avance = useAvanceMode(map, filter);
  // «Nueva capa» (ma03): opened from «Trabajos» or from «Modo Avance», where the new layer is picked.
  const [newLayer, setNewLayer] = useState<'map' | 'avance' | null>(null);
  const [recordingStart, setRecordingStart] = useState(false);
  const [recordDraft, setRecordDraft] = useState<ManualProgressDraft | undefined>(undefined);
  // «Registrar avance» (ma04): the street it opens on, or null for the GPS to pick it.
  const [recording, setRecording] = useState<{ streetId: string | null; workId: string | null } | null>(null);
  // Design ma01: the active layer (the first until one is picked) drives the sheet and «Registrar».
  const [chosenLayer, setChosenLayer] = useState<string | null>(null);
  // The work picked in the map's select is the active layer too, so the sheet and the map agree.
  const layer = useMemo(() => activeLayerOf(map, byApprove.list, filter.workId ?? chosenLayer, limaDayKey(new Date()), filter), [map, byApprove.list, filter, chosenLayer]);
  const target = useMemo(() => progressTargetOf(map), [map]);
  const openStreet = (id: string | null, record = false, draft?: ManualProgressDraft) => { setRecordingStart(record); setRecordDraft(draft); setStreetId(id); };
  const record = () => setRecording({ streetId: target.kind === 'street' ? target.streetId : null, workId: layer.workId });
  // No street to frame: the map frames the photos and the units (Portal via José 09/11).
  const view = useMemo(() => withMediaBounds(workMapView(map, filter), props.mapPhotos ?? NO_MAP_PHOTOS, props.discharges ?? NO_DISCHARGES), [map, filter, props.mapPhotos, props.discharges]);
  const groups = useMemo(() => workMapStageGroups(map, view), [map, view]);
  const stations = useMemo(() => visibleStationMarks(map.streets, view.streets.map((street) => street.id)), [map, view]);
  const bare = useMemo(() => bareLinesOf({ streets: map.streets.filter((street) => view.streets.some((shown) => shown.id === street.id)), scopes: map.scopes }), [map, view]);
  const mapDays = useMapDays(props.mapPhotos ?? NO_MAP_PHOTOS, props.discharges ?? NO_DISCHARGES);
  const pista = useDischarges(map, props.discharges ?? NO_DISCHARGES, mapDays.day, mapDays.days);
  // The units' numbers, plates and stretches only under the paving work (José 09/11).
  const units = showsUnitPins(map, filter);
  const unitPins = units ? pista.pins : NO_UNIT_PINS;
  const photoLayer = usePhotoLayer(map, mapDays.photos, mapDays.days);
  const [pendingItems, setPendingItems] = useState<PendingProgress[]>([]);
  const stretches = units ? pista.stretches : NO_BRUSH_LINES;
  const pendingLines = useMemo(() => (byApprove.list ? byApproveLinesOf(map, byApprove.list) : pendingLinesOf(map, pendingItems)), [map, byApprove.list, pendingItems]);
  const waiting = byApprove.list ? pendingCountOf(byApprove.list) : pendingItems.length;
  const { holder, expanded, open, close } = useFullScreen();
  const picks = useMapPick(map, props.onLift);
  const wide = useWide(holder);
  const discharges = pista.suggestion.units.length ? <WorkMapDischarges map={map} serviceId={props.serviceId} suggestion={pista.suggestion} send={props.send} ranges={pista.ranges} onRange={pista.onRange} /> : null;
  const primeCoat = props.editMap && props.mapPhotos?.length ? <PrimeCoatSuggestions map={map} photos={props.mapPhotos} onRecord={(id, draft) => openStreet(id, true, draft)} /> : null;
  // José 09/11: what was sent waits here until approved, instead of vanishing. It is drawn over its street too.
  // José 28/11 (design ma05): «Avances» with Hoy / Semana / Todo once Portal lists them; an older Portal keeps «Por aprobar».
  const feed = props.editMap && byApprove.list ? <ProgressFeed map={map} list={byApprove.list} send={props.editMap} admin={Boolean(props.admin)} onUndo={byApprove.undo} onChanged={() => { byApprove.reload(); props.reload?.(); }} /> : null;
  const pending = feed ?? (props.editMap ? <PendingProgressCard send={props.editMap} admin={Boolean(props.admin)} reloadKey={props.map} onList={setPendingItems} byApprove={{ list: byApprove.list, map, onUndo: byApprove.undo }} /> : null);
  const top = discharges || primeCoat || pending ? <div className="space-y-5">{pending}{discharges}{primeCoat}</div> : null;
  const streetPanel = streetId ? <StreetScopes key={`${streetId}|${recordingStart}|${recordDraft?.fromM}-${recordDraft?.toM}`} map={map} streetId={streetId} send={props.editMap} uploadPhoto={props.uploadPhoto} startRecording={recordingStart} recordDraft={recordDraft} onBack={() => openStreet(null)} /> : null;
  const deletedPanel = seeingDeleted && props.editMap ? <DeletedWork map={map} send={props.editMap} onClose={() => setSeeingDeleted(false)} /> : null;
  const sidePanel = side === 'export'
    ? <WorkMapExport map={map} filter={filter} onFilter={setFilter} title={props.title} pageUrl={pageUrl} send={props.editMap} uploadTrace={props.uploadTrace} onClose={() => setSide(null)} />
    : side === 'share' ? <ShareProgress map={map} filter={filter} onFilter={setFilter} send={props.editMap} mapInReport={props.mapInReport} onClose={() => setSide(null)} /> : null;
  const layersPanel = layers && props.editMap ? <WorkLayers map={map} kind={layers} send={props.editMap} brush={brushing.brush} onBrush={brushing.setBrush} onNewLayer={() => { closeLayers(); setNewLayer('map'); }} onClose={closeLayers} /> : null;
  const mapLayers = useMapLayers();
  const drawn = useMemo(() => ({ view: viewWithLayers(view, mapLayers.layers), marks: visibleMarks(map.marks ?? NO_MARKS, mapLayers.layers), observations: visibleObservations(map.observations ?? NO_OBSERVATIONS, mapLayers.layers) }), [view, map, mapLayers.layers]);
  const layersNode = mapLayers.open ? <MapLayersPanel map={map} view={view} filter={filter} onFilter={setFilter} layers={mapLayers.layers} onToggle={mapLayers.toggle} photos={photoLayer.available ? { count: photoLayer.count, shown: photoLayer.shown, onToggle: photoLayer.toggle, reports: photoLayer.reports, onToggleReport: photoLayer.toggleReport } : undefined} /> : null;
  const avancePanel = avance.on && props.editMap && (wide || avance.target) ? <AvancePanel map={map} target={avance.target} send={props.editMap} undoable={avance.target ? undoableOf(byApprove.list, avance.target.streetId, avance.target.workId) : null} onUndo={byApprove.undo} /> : null;
  const layerCreated = (id: string, paint: boolean) => {
    const from = newLayer;
    setNewLayer(null);
    if (paint) { avance.exit(); setLayers('works'); brushing.setBrush({ kind: 'work', id }); }
    else if (from === 'avance') avance.pick(id);
    else setFilter({ workId: id });
  };
  const newLayerPanel = newLayer && props.editMap ? <NewLayer map={map} send={props.editMap} onCreated={layerCreated} onClose={() => setNewLayer(null)} /> : null;
  const other = newLayerPanel ?? avancePanel ?? deletedPanel ?? layersPanel ?? sidePanel ?? streetPanel;
  const onLayerRecord = props.editMap && target.kind !== 'none' ? record : undefined;
  const layerHead = layer.summary ? <LayerSheet summary={layer.summary} latest={layer.latest} badge={props.badge} onRecord={onLayerRecord} /> : undefined;
  const panel = other ?? <WorkMapPanel head={layerHead} view={view} groups={groups} filter={filter} badge={props.badge} top={top} items={picks.items} layers={layersNode} scrolls={wide} deleteStreet={props.deleteStreet} onOpenStreet={(id) => openStreet(id)} />;
  // A phone: the map takes the screen and the panel is a sheet over it, open on demand (José 20/11).
  // Design ma01: the sheet opens with the map when there are layers; a chip opens it too.
  const [sheet, setSheet] = useState(() => props.map.works.length > 0);
  const pickLayer = (id: string) => { setChosenLayer(id); setSheet(true); if (filter.workId) setFilter(workMapWorkFilter(filter, id)); };
  const [legendOpen, setLegendOpen] = useState(false);
  const sheetShown = wide || sheet || Boolean(other);
  const showLayers = () => {
    setSide(null); setLayers(null); setStreetId(null);
    if (wide) { mapLayers.setOpen((shown) => !shown); return; }
    const opening = !(sheet && mapLayers.open);
    setSheet(opening);
    mapLayers.setOpen(opening);
  };
  const closeSheet = () => { setNewLayer(null); avance.closeStreet(); setSheet(false); setSide(null); closeLayers(); setStreetId(null); setSeeingDeleted(false); };
  const pick = (key: Exclude<MapMoreKey, 'open'>) => {
    if (key === 'share' || key === 'export') toggleSide(key);
    else if (key === 'screen') (expanded ? close : open)();
    else if (key === 'draw') props.onDraw?.();
    else if (key === 'stages' || key === 'works') { setSide(null); brushing.setBrush(null); setLayers((shown) => (shown === key ? null : key)); }
    else setSeeingDeleted((shown) => !shown);
  };
  const editMap = props.editMap;
  const openAvance = () => { setSheet(false); setSide(null); closeLayers(); setStreetId(null); setSeeingDeleted(false); avance.open(); };
  const tools: ToolProps = { pageUrl, expanded, layersOpen: wide ? mapLayers.open : sheet && mapLayers.open, onLayersPanel: showLayers, onPick: pick, draws: Boolean(props.onDraw), edits: Boolean(props.editMap), admin: Boolean(props.admin && props.editMap), onRecord: props.editMap && target.kind !== 'none' ? () => { setSide(null); record(); } : undefined, onAvance: props.editMap ? openAvance : undefined, croquis: editMap ? (className) => <ServiceCroquisButton send={editMap} title={props.title} onDone={() => props.reload?.()} className={className} /> : undefined };
  const days = mapDays.options.length ? <MapDayChips options={mapDays.options} day={mapDays.day} onDay={mapDays.setDay} /> : null;
  const notice = props.notice ? <p role="status" data-testid="mapa-aviso" className="pointer-events-auto rounded-xl border border-primary/30 bg-surface px-3 py-2 text-[13px] font-semibold text-on-surface shadow-md">{props.notice}</p> : null;
  const layerChips = <LayerChips testPrefix="mapa-capa" chips={layer.chips} onPick={pickLayer} />;
  const filters = <MapFilters map={map} view={view} filter={filter} onFilter={setFilter} />;
  const legend = <MapLegendCard view={view} waiting={waiting} />;
  return (
    <div ref={holder} data-testid="mapa-servicio" data-expanded={expanded} data-wide={wide} className={`flex flex-col overflow-hidden bg-background ${expanded ? 'fixed inset-0 z-50' : 'min-h-0 flex-1'}`}>
      {props.head ? <header className={`${MAP_HEAD_BAR} relative z-20 pb-3`}><div className="min-w-0 flex-1">{props.head}</div></header> : null}
      <div className={wide ? 'flex min-h-0 flex-1' : 'relative flex min-h-0 flex-1 flex-col'}>
        <div className={`relative min-h-[320px] overflow-hidden bg-surface-variant ${wide ? 'min-w-0 flex-1' : 'flex-1'}`}>
          <Suspense fallback={<div data-testid="mapa-cargando-lienzo" className="absolute inset-0 animate-pulse bg-surface-variant" />}>
            <WorkMapCanvas view={drawn.view} expanded={expanded} stations={stations} bare={bare} marks={drawn.marks} observations={drawn.observations} selected={picks.selected} onSelect={picks.setSelected} onCardPhoto={(photo, all) => picks.openPhoto(photo, all)} focus={picks.focus} pins={photoLayer.shown ? photoLayer.pins : unitPins} onPin={photoLayer.shown ? photoLayer.openPin : undefined} stretches={brushing.brush ? brushLines : avance.on ? avance.lines : stretches} pending={avance.on ? pendingLines.filter((line) => line.workId === avance.workId) : pendingLines} onTap={brushing.brush ? (place) => void brushing.tap(place) : avance.on ? avance.tap : undefined} />
          </Suspense>
          {brushing.brush ? <BrushBand title={brushTitle(map, brushing.brush)} error={brushing.error} busy={brushing.busy} canUndo={brushing.canUndo} onUndo={() => void brushing.undo()} onDone={() => brushing.setBrush(null)} /> : null}
          {avance.on && editMap ? <AvanceTop mode={avance} title={props.title} onNewLayer={() => setNewLayer('avance')} /> : null}
          {brushing.brush || avance.on ? null : wide ? (
            <>
              <div data-testid="mapa-flotante" className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-col items-start gap-2">
                <div className="w-full min-w-0">{layerChips}</div>
                <div className="flex w-full min-w-0 items-start gap-2">{days ? <div className="min-w-0 shrink">{days}</div> : null}<WideTools {...tools} /></div>
                {filters}
                {notice}
              </div>
              <div className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-[70%]">{legend}</div>
            </>
          ) : (
            <>
              <div data-testid="mapa-flotante" className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-2">
                {layerChips}
                {days}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-2">{filters}{notice}</div>
                  <NarrowRail {...tools} legend={view.works.length > 0} legendOpen={legendOpen} onLegend={() => setLegendOpen((shown) => !shown)} />
                </div>
              </div>
              <NarrowFoot {...tools} legend={legendOpen ? legend : null} />
            </>
          )}
        </div>
        <aside data-testid="mapa-panel" data-open={sheetShown} className={wide ? 'm-3 ml-0 flex w-[380px] shrink-0 flex-col overflow-hidden rounded-2xl border border-outline/15 bg-surface shadow-lg xl:w-[400px]' : `absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-y-auto rounded-t-3xl border-t border-outline/15 bg-surface shadow-[0_-8px_24px_rgb(0_0_0/0.12)] ${brushing.brush ? 'max-h-[40%]' : 'max-h-[72%]'} ${sheetShown ? '' : 'hidden'}`}>
          {wide ? null : <SheetTop onClose={closeSheet} />}
          {panel}
        </aside>
      </div>
      {photoLayer.viewer}
      {picks.viewer}
      {props.editMap && recording ? <ManualProgress map={map} streetId={recording.streetId} send={props.editMap} uploadPhoto={props.uploadPhoto} workId={recording.workId} onDone={() => { setRecording(null); byApprove.reload(); }} /> : null}
    </div>
  );
}

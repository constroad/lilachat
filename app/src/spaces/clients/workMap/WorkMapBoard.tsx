import { useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { Route, TrendingUp, X } from 'lucide-react-native';
import { activeLayerOf, limaDayKey, workMapWorkFilter, viewWithLayers, visibleMarks, visibleObservations, type WorkMapMark, type WorkMapObservation, mapCardOf, mapPickAnchor, mapPickOnMap, type MapPick, type WorkMapPoint, bareLinesOf, visibleStationMarks, progressTargetOf, type Brush, type ManualPhotoUpload, type MapEditSend, type TraceUpload, type ServiceMapInReport, unitPinsOfDay, withMediaBounds, pendingLinesOf, byApproveLinesOf, pendingCountOf, withPendingOf, showsUnitPins, type PendingProgress, type MapMoreKey, stretchLinesOf, suggestDischarges, workMapStageGroups, workMapView, type DischargePin, type StationMark, type StretchRange, type UnitDischarge, type MapPhoto, type ManualProgressDraft, type WorkMapLine, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';
import { WorkMapDischarges, type ProgressSend } from './WorkMapDischarges';
import { WorkMapExport } from './WorkMapExport';
import { ShareProgress } from './ShareProgress';
import { WorkMapFilters, WorkMapLegend } from './WorkMapFilters';
import { LayersButton, LegendButton, MAP_SHADOW } from './MapFloating';
import { MapMoreMenu } from './MapMoreMenu';
import { WorkMapPanel } from './WorkMapPanel';
import type { StreetDeleteSend } from './StreetDelete';
import { ManualProgress, type PhotoAsset } from './ManualProgress';
import { ProgressFeed } from './ProgressFeed';
import type { TraceFile } from '../useDriveUpload';
import { StreetScopes } from './StreetScopes';
import { DeletedWork } from './DeletedWork';
import { WorkMapSurface } from './WorkMapSurface';
import { BrushMap, WorkLayersSheet, type LayersKind } from './WorkLayers';
import { usePhotoLayer } from './MapPhotos';
import { MapLayersPanel, useMapLayers } from './MapLayersPanel';
import { MapDayChips, useMapDays } from './MapDays';
import { PrimeCoatSuggestions } from './PrimeCoat';
import { PendingProgressCard, useByApprove } from './PendingProgress';
import { MapCardView } from './MapCardView';
import { WorkMapItems, type LiftRow } from './WorkMapItems';
import { useFileViewer } from '../useFileViewer';
import { ServiceCroquisButton } from './ServiceCroquis';
import { AvanceMode } from './AvanceMode';
import { NewLayerSheet } from './NewLayer';
import { LayerChips } from './LayerChips';
import { LayerSheet } from './LayerSheet';
import { useDisposicion } from '../../../ui/useDisposicion';

type PhotoLayer = ReturnType<typeof usePhotoLayer>;
const NO_MARKS: NonNullable<WorkMap['marks']> = [];
const NO_OBSERVATIONS: NonNullable<WorkMap['observations']> = [];
/** The card stays readable on a tablet or a phone turned sideways. */
const CARD_MAX_WIDTH = 440;
/** The panel's sheet leaves the top of the map, with its days and cut, in sight. */
const PANEL_MAX_HEIGHT = '75%';
const PANEL_CONTENT = { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 };
/** Tablet or phone turned (design ma01 tablet): the sheet is a column beside the map. */
const SIDE_PANEL_WIDTH = 400;

/**
 * The card picked on the full map or in the lists (José 19/11): a list item opens the full map
 * there; an observation with no place shows its card under the lists instead.
 */
function useMapPick(map: WorkMap, openFull: () => void, onLift?: (row: LiftRow) => void) {
  const [selected, setSelected] = useState<MapPick | null>(null);
  const [startAt, setStartAt] = useState<WorkMapPoint | null>(null);
  const files = useFileViewer();
  const [marks, observations] = [map.marks ?? NO_MARKS, map.observations ?? NO_OBSERVATIONS];
  const card = selected ? mapCardOf(selected, marks, observations) : null;
  const placed = selected ? Boolean(mapPickAnchor(selected, marks, observations)) : false;
  const pickFromList = (pick: MapPick) => {
    setSelected(pick);
    const anchor = mapPickAnchor(pick, marks, observations);
    if (!anchor) return;
    setStartAt(anchor);
    openFull();
  };
  const close = () => setSelected(null);
  // A pin right under a drawing opens the drawing's card, which carries the pin's photos (José 19/11).
  const pickOnMap = (pick: MapPick) => setSelected(mapPickOnMap(pick, marks, observations));
  const inline = card && !placed ? <View className="mt-4"><MapCardView card={card} onClose={close} onPhoto={(photo, all) => files.open(photo, all)} /></View> : null;
  const items = marks.length || observations.length ? <View>{inline}<WorkMapItems map={map} onPick={pickFromList} onLift={onLift} /></View> : null;
  return { selected, setSelected, pickOnMap, card: placed ? card : null, close, startAt, clearStart: () => setStartAt(null), items, files };
}

type MapPicks = ReturnType<typeof useMapPick>;

function FullMap(props: { view: WorkMapView; open: boolean; onClose: () => void; pins: DischargePin[]; stretches: WorkMapLine[]; pending: WorkMapLine[]; stations: StationMark[]; bare: WorkMapLine[]; photos: PhotoLayer; marks: readonly WorkMapMark[]; observations: readonly WorkMapObservation[]; picks: MapPicks }) {
  const colors = useColores();
  const margins = useMargenes();
  const { picks } = props;
  return (
    <Modal visible={props.open} animationType="slide" onRequestClose={props.onClose}>
      <View className="flex-1 bg-background">
        {props.open ? <WorkMapSurface view={props.view} moves controlsInset={margins.pie} stations={props.stations} bare={props.bare} marks={props.marks} observations={props.observations} onPick={picks.pickOnMap} startAt={picks.startAt} pins={props.photos.shown ? props.photos.pins : props.pins} onPin={props.photos.shown ? props.photos.openPin : undefined} stretches={props.stretches} pending={props.pending} /> : null}
        {picks.card ? (
          <View className="absolute inset-x-3 items-center" style={{ bottom: margins.pie + 72 }}>
            <View style={{ width: '100%', maxWidth: CARD_MAX_WIDTH }}>
              <MapCardView card={picks.card} onClose={picks.close} onPhoto={(photo, all) => picks.files.open(photo, all)} />
            </View>
          </View>
        ) : null}
        <Pressable testID="mapa-cerrar-completo" accessibilityLabel="Cerrar el mapa" onPress={props.onClose} className="absolute right-3 h-12 w-12 items-center justify-center rounded-full bg-surface" style={{ top: margins.cabecera + 8 }}>
          <X size={22} color={colors['on-surface']} />
        </Pressable>
      </View>
      {props.photos.viewer}
      {picks.files.viewer}
    </Modal>
  );
}

const NO_DISCHARGES: UnitDischarge[] = [];
const NO_MAP_PHOTOS: MapPhoto[] = [];
const NO_UNIT_PINS: DischargePin[] = [];
const NO_LINES: WorkMapLine[] = [];

/** The units of the Control de pista over the map: the suggestion, its pins and the stretches being confirmed. */
function useDischarges(map: WorkMap, discharges: UnitDischarge[], day: string, days: string[]) {
  const suggestion = useMemo(() => suggestDischarges(map, discharges), [map, discharges]);
  const [ranges, setRanges] = useState<Record<string, StretchRange>>({});
  // The chosen day's units, numbered inside their day and ringed with its color (José 09/11).
  const pins = useMemo(() => unitPinsOfDay(suggestion, discharges, day, days), [suggestion, discharges, day, days]);
  const stretches = useMemo(() => stretchLinesOf(map, suggestion.stretches, ranges), [map, suggestion, ranges]);
  return { suggestion, ranges, pins, stretches, onRange: (streetId: string, range: StretchRange) => setRanges((before) => ({ ...before, [streetId]: range })) };
}

type BoardProps = { /** «Levantar» on an open observation (José 27/11). */ onLift?: (row: LiftRow) => void; map: WorkMap; pageUrl: string; title: string; serviceId: string; /** The service's state beside «Avance de la obra». */ badge?: ReactNode; discharges?: UnitDischarge[]; /** Field photos with their place: the «Fotos» layer (José 08/11). */ mapPhotos?: MapPhoto[]; send?: ProgressSend; /** «Una sola calle» (o-02). */ onDraw?: () => void; /** «Marcar calles» (ma02). */ onArea?: () => void; /** «Borrar calle»: anyone, logical (José 07/11). */ deleteStreet?: StreetDeleteSend; /** Stretches, stages and works (o-03 to o-05). */ editMap?: MapEditSend; /** A space admin: «Borrados» and «Restaurar» (José 07/11). */ admin?: boolean; /** Photos of «Registrar avance» (o-06). */ uploadPhoto?: ManualPhotoUpload<PhotoAsset>; /** KMZ or KML for «Importar» (o-12). */ uploadTrace?: TraceUpload<TraceFile>; /** «Incluir en el informe» as Portal has it. */ mapInReport?: ServiceMapInReport; /** What the last save answered, over the map. */ notice?: string | null; /** Reads the map again (after «Editar croquis»). */ reload?: () => void };

/** The panel as a sheet over the map (José 20/11, design mapa-v2): hidden, never unmounted, so what waits approval is still drawn. */
function PanelOverlay(props: { open: boolean; side: boolean; onClose: () => void; children: ReactNode }) {
  const colors = useColores();
  const place: ViewStyle = props.side ? { width: SIDE_PANEL_WIDTH } : { left: 0, right: 0, bottom: 0, maxHeight: PANEL_MAX_HEIGHT };
  return (
    <View testID="mapa-panel" accessibilityElementsHidden={!props.open} className={`overflow-hidden bg-surface ${props.side ? 'border-l border-outline/15' : 'absolute rounded-t-3xl'}`} style={{ ...place, display: props.open ? 'flex' : 'none', elevation: 12 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={PANEL_CONTENT}>{props.children}</ScrollView>
      <Pressable testID="mapa-hoja-cerrar" accessibilityLabel="Cerrar el panel" onPress={props.onClose} className="absolute right-2 top-1 h-11 w-11 items-center justify-center rounded-full">
        <X size={20} color={colors['on-surface-variant']} />
      </Pressable>
    </View>
  );
}

type FloatingProps = { /** The strip of layers (ma01). */ layerChips: ReactNode; map: WorkMap; view: WorkMapView; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void; days: ReturnType<typeof useMapDays>; notice?: string | null; layersOpen: boolean; onLayers: () => void; legendOpen: boolean; onLegend: () => void; onMore: (key: MapMoreKey) => void; draws: boolean; edits: boolean; admin: boolean };

/** The top of the map (design mapa-v2 mobile): the days, «Hasta hoy ▾», and the round buttons on the right. */
function MapTop(props: FloatingProps) {
  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 top-3 gap-2">
      {props.layerChips}
      <MapDayChips options={props.days.options} day={props.days.day} onDay={props.days.setDay} />
      <View pointerEvents="box-none" className="flex-row items-start gap-2 px-3">
        <View pointerEvents="box-none" className="min-w-0 flex-1 gap-2">
          <WorkMapFilters map={props.map} view={props.view} filter={props.filter} onFilter={props.onFilter} />
          {props.notice ? <Text testID="mapa-aviso" accessibilityRole="alert" className="self-start rounded-xl border border-primary/30 bg-surface px-3 py-2 text-[14px] font-semibold text-on-surface" style={MAP_SHADOW}>{props.notice}</Text> : null}
        </View>
        <View pointerEvents="box-none" className="gap-2">
          <LayersButton open={props.layersOpen} onToggle={props.onLayers} />
          {props.view.works.length ? <LegendButton open={props.legendOpen} onToggle={props.onLegend} /> : null}
          <MapMoreMenu onPick={props.onMore} draws={props.draws} edits={props.edits} admin={props.admin} share screen="open" />
        </View>
      </View>
    </View>
  );
}

/** The foot of the map: the legend, «Editar croquis» small and «Registrar» (zoom and GPS on the right), raised over the map attribution (E2E 20/11). */
function MapFoot(props: { legend: ReactNode; croquis: ReactNode; onRecord?: () => void; /** «Avance» (design av-01): only who can edit the map. */ onAvance?: () => void }) {
  const colors = useColores();
  return (
    <View pointerEvents="box-none" className="absolute bottom-8 left-3 right-20 items-start gap-2">
      {props.legend}
      <View pointerEvents="box-none" className="flex-row flex-wrap gap-2">
        {props.croquis}
        {props.onAvance ? (
          <Pressable testID="mapa-modo-avance" onPress={props.onAvance} className="h-11 flex-row items-center gap-2 rounded-full border border-primary/40 bg-surface px-4" style={MAP_SHADOW}>
            <Route size={18} color={colors.primary} />
            <Text className="text-[15px] font-semibold text-primary">Avance</Text>
          </Pressable>
        ) : null}
        {props.onRecord ? (
          <Pressable testID="mapa-registrar-avance" onPress={props.onRecord} className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-4" style={MAP_SHADOW}>
            <TrendingUp size={18} color={colors['on-primary']} />
            <Text className="text-[15px] font-semibold text-on-primary">Registrar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The map of the work on the phone (José 20/11, design mapa-v2): the map takes the screen under the
 * service's head and moves; the days, the cut and the tools float over it. «Capas» opens the panel
 * (layers, progress, what waits, the lists) as a sheet; «Más» holds «Compartir avance» and the full
 * screen.
 */
export function WorkMapBoard(props: BoardProps) {
  const { pageUrl } = props;
  // José 28/11: what waits for approval comes with the map; «desde» skips it. Without the list, today's map.
  const byApprove = useByApprove(props.editMap, props.map);
  const map = useMemo(() => withPendingOf(props.map, byApprove.list), [props.map, byApprove.list]);
  const [filter, setFilter] = useState<WorkMapFilter>({});
  const [wide, setWide] = useState(false);
  const [side, setSide] = useState<'export' | 'share' | null>(null);
  const [streetId, setStreetId] = useState<string | null>(null);
  const [seeingDeleted, setSeeingDeleted] = useState(false);
  const [recordingStart, setRecordingStart] = useState(false);
  const [recordDraft, setRecordDraft] = useState<ManualProgressDraft | undefined>(undefined);
  // «Registrar avance» (ma04): the street it opens on, or null for the GPS to pick it.
  const [recording, setRecording] = useState<{ streetId: string | null; workId: string | null } | null>(null);
  const [layers, setLayers] = useState<LayersKind | null>(null);
  // «Nueva capa» (ma03) brushes from the map or from «Modo Avance»: the brush returns there.
  const [brush, setBrush] = useState<{ brush: Brush; from: LayersKind | 'map' | 'avance' } | null>(null);
  const [newLayer, setNewLayer] = useState(false);
  // Design ma01: the sheet of the active layer opens with the map when there are layers.
  const [sheet, setSheet] = useState(() => props.map.works.length > 0);
  const [chosenLayer, setChosenLayer] = useState<string | null>(null);
  // The work picked in the map's select is the active layer too, so the sheet and the map agree.
  const layer = useMemo(() => activeLayerOf(map, byApprove.list, filter.workId ?? chosenLayer, limaDayKey(new Date()), filter), [map, byApprove.list, filter, chosenLayer]);
  const pickLayer = (id: string) => { setChosenLayer(id); setSheet(true); if (filter.workId) setFilter(workMapWorkFilter(filter, id)); };
  const { amplia } = useDisposicion();
  const [legendOpen, setLegendOpen] = useState(false);
  const [avance, setAvance] = useState<{ workId: string | null } | null>(null);
  const target = useMemo(() => progressTargetOf(map), [map]);
  const openStreet = (id: string | null, record = false, draft?: ManualProgressDraft) => { setRecordingStart(record); setRecordDraft(draft); setStreetId(id); };
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
  const photos = usePhotoLayer(map, mapDays.photos, mapDays.days);
  const [pendingItems, setPendingItems] = useState<PendingProgress[]>([]);
  const stretches = units ? pista.stretches : NO_LINES;
  const pendingLines = useMemo(() => (byApprove.list ? byApproveLinesOf(map, byApprove.list) : pendingLinesOf(map, pendingItems)), [map, byApprove.list, pendingItems]);
  const waiting = byApprove.list ? pendingCountOf(byApprove.list) : pendingItems.length;
  const picks = useMapPick(map, () => setWide(true), props.onLift);
  const mapLayers = useMapLayers();
  const drawn = useMemo(() => ({ view: viewWithLayers(view, mapLayers.layers), marks: visibleMarks(map.marks ?? NO_MARKS, mapLayers.layers), observations: visibleObservations(map.observations ?? NO_OBSERVATIONS, mapLayers.layers) }), [view, map, mapLayers.layers]);
  const layersNode = mapLayers.open ? <MapLayersPanel map={map} view={view} filter={filter} onFilter={setFilter} layers={mapLayers.layers} onToggle={mapLayers.toggle} photos={photos.available ? { count: photos.count, shown: photos.shown, onToggle: () => photos.setShown(!photos.shown), reports: photos.reports, onToggleReport: photos.toggleReport } : undefined} /> : null;
  const closeFull = () => { setWide(false); picks.clearStart(); picks.close(); };
  const discharges = pista.suggestion.units.length ? <WorkMapDischarges map={map} serviceId={props.serviceId} suggestion={pista.suggestion} send={props.send} ranges={pista.ranges} onRange={pista.onRange} /> : null;
  const primeCoat = props.editMap && props.mapPhotos?.length ? <PrimeCoatSuggestions map={map} photos={props.mapPhotos} onRecord={(id, draft) => openStreet(id, true, draft)} /> : null;
  // José 09/11: what was sent waits here until approved, instead of vanishing. It is drawn over its street too.
  // José 28/11 (design ma05): «Avances» with Hoy / Semana / Todo once Portal lists them; an older Portal keeps «Por aprobar».
  const feed = props.editMap && byApprove.list ? <ProgressFeed map={map} list={byApprove.list} send={props.editMap} admin={Boolean(props.admin)} onUndo={byApprove.undo} onChanged={() => { byApprove.reload(); props.reload?.(); }} /> : null;
  const pending = feed ?? (props.editMap ? <PendingProgressCard send={props.editMap} admin={Boolean(props.admin)} reloadKey={props.map} onList={setPendingItems} byApprove={{ list: byApprove.list, map, onUndo: byApprove.undo }} /> : null);
  const top = discharges || primeCoat || pending ? <View className="gap-5">{pending}{discharges}{primeCoat}</View> : null;
  const more = (key: MapMoreKey) => {
    if (key === 'share' || key === 'export') setSide(key);
    else if (key === 'screen') setWide(true);
    else if (key === 'draw') props.onDraw?.();
    else if (key === 'area') props.onArea?.();
    else if (key === 'stages' || key === 'works') setLayers(key);
    else if (key === 'open' && pageUrl) void Linking.openURL(pageUrl);
    else setSeeingDeleted(true);
  };
  const toggleSheet = () => {
    const opening = !(sheet && mapLayers.open);
    setSheet(opening);
    mapLayers.setOpen(opening);
  };
  const record = props.editMap && target.kind !== 'none' ? () => setRecording({ streetId: target.kind === 'street' ? target.streetId : null, workId: layer.workId }) : undefined;
  const layerHead = layer.summary ? <LayerSheet summary={layer.summary} latest={layer.latest} badge={props.badge} onRecord={record} /> : undefined;
  // After «Nueva capa» the map shows the new layer alone (ma03); off, the brush paints it first.
  const layerCreated = (id: string, paint: boolean) => {
    setNewLayer(false);
    if (paint) setBrush({ brush: { kind: 'work', id }, from: 'map' });
    else setFilter({ workId: id });
  };
  const brushDone = () => {
    const from = brush?.from;
    setBrush(null);
    if (from === 'avance') setAvance({ workId: brush?.brush.id ?? null });
    else if (from === 'map') setFilter({ workId: brush?.brush.id });
    else if (from) setLayers(from);
  };
  const panel = (
    <PanelOverlay open={sheet} side={amplia} onClose={() => setSheet(false)}>
      <WorkMapPanel head={layerHead} view={view} groups={groups} filter={filter} badge={props.badge} top={top} items={picks.items} layers={layersNode} deleteStreet={props.deleteStreet} onOpenStreet={(id) => openStreet(id)} />
    </PanelOverlay>
  );
  const croquis = props.editMap ? <ServiceCroquisButton send={props.editMap} title={props.title} onDone={() => props.reload?.()} pill /> : null;
  return (
    <View testID="mapa-servicio" className="flex-1">
      {wide ? null : picks.files.viewer}
      <View className="flex-1 flex-row">
      <View className="flex-1 overflow-hidden bg-surface-variant">
        {wide ? null : <WorkMapSurface view={drawn.view} moves stations={stations} bare={bare} marks={drawn.marks} observations={drawn.observations} onPick={picks.pickOnMap} pins={photos.shown ? photos.pins : unitPins} onPin={photos.shown ? photos.openPin : undefined} stretches={stretches} pending={pendingLines} />}
        {picks.card && !wide ? (
          <View className="absolute inset-x-3 bottom-20 items-center">
            <View style={{ width: '100%', maxWidth: CARD_MAX_WIDTH }}><MapCardView card={picks.card} onClose={picks.close} onPhoto={(photo, all) => picks.files.open(photo, all)} /></View>
          </View>
        ) : null}
        <MapTop layerChips={<LayerChips testPrefix="mapa-capa" chips={layer.chips} onPick={pickLayer} />} map={map} view={view} filter={filter} onFilter={setFilter} days={mapDays} notice={props.notice} layersOpen={sheet && mapLayers.open} onLayers={toggleSheet} legendOpen={legendOpen} onLegend={() => setLegendOpen(!legendOpen)} onMore={more} draws={Boolean(props.onDraw)} edits={Boolean(props.editMap)} admin={Boolean(props.admin)} />
        <MapFoot legend={legendOpen ? <WorkMapLegend view={view} waiting={waiting} /> : null} croquis={croquis} onRecord={record} onAvance={props.editMap ? () => setAvance({ workId: null }) : undefined} />
        {amplia ? null : panel}
      </View>
      {amplia ? panel : null}
      </View>
      <FullMap view={drawn.view} open={wide} onClose={closeFull} pins={unitPins} stretches={stretches} pending={pendingLines} stations={stations} bare={bare} photos={photos} marks={drawn.marks} observations={drawn.observations} picks={picks} />
      {props.editMap ? <DeletedWork open={seeingDeleted} map={map} send={props.editMap} onClose={() => setSeeingDeleted(false)} /> : null}
      <StreetScopes map={map} streetId={streetId} send={props.editMap} uploadPhoto={props.uploadPhoto} startRecording={recordingStart} recordDraft={recordDraft} onClose={() => openStreet(null)} />
      {props.editMap && recording ? <ManualProgress map={map} streetId={recording.streetId} send={props.editMap} uploadPhoto={props.uploadPhoto} workId={recording.workId} onDone={() => { setRecording(null); byApprove.reload(); }} /> : null}
      <WorkMapExport open={side === 'export'} map={map} filter={filter} onFilter={setFilter} title={props.title} pageUrl={pageUrl} send={props.editMap} uploadTrace={props.uploadTrace} onClose={() => setSide(null)} />
      {props.editMap ? <WorkLayersSheet kind={layers} map={map} send={props.editMap} onBrush={(picked) => { setBrush({ brush: picked, from: layers ?? 'stages' }); setLayers(null); }} onNewLayer={() => { setLayers(null); setNewLayer(true); }} onClose={() => setLayers(null)} /> : null}
      {props.editMap ? <NewLayerSheet open={newLayer} map={map} send={props.editMap} onCreated={layerCreated} onClose={() => setNewLayer(false)} /> : null}
      {props.editMap && brush ? <BrushMap map={map} send={props.editMap} brush={brush.brush} onDone={brushDone} /> : null}
      {props.editMap && avance ? <AvanceMode map={map} filter={filter} title={props.title} send={props.editMap} byApprove={byApprove.list} onUndo={byApprove.undo} initialWorkId={avance.workId} onPaint={(id) => { setAvance(null); setBrush({ brush: { kind: 'work', id }, from: 'avance' }); }} onExit={() => setAvance(null)} /> : null}
      <ShareProgress open={side === 'share'} map={map} filter={filter} onFilter={setFilter} send={props.editMap} mapInReport={props.mapInReport} onClose={() => setSide(null)} />
    </View>
  );
}

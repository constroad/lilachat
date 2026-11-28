import { useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { expandLayerSheet, initialMapSheet, layerMapLinesOf, sheetForLayerPick, toggleLayersSheet, type LayerStreetSummary, type MapSheet, activeLayerOf, limaDayKey, workMapWorkFilter, viewWithLayers, visibleMarks, visibleObservations, type WorkMapMark, type WorkMapObservation, mapCardOf, mapPickAnchor, mapPickOnMap, type MapPick, type WorkMapPoint, visibleStationMarks, progressTargetOf, type Brush, type ManualPhotoUpload, type MapEditSend, type TraceUpload, type ServiceMapInReport, unitPinsOfDay, withMediaBounds, pendingLinesOf, byApproveLinesOf, pendingCountOf, withPendingOf, showsUnitPins, type PendingProgress, type MapMoreKey, stretchLinesOf, suggestDischarges, workMapStageGroups, workMapView, type DischargePin, type StationMark, type StretchRange, type UnitDischarge, type MapPhoto, type ManualProgressDraft, type WorkMapLine, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';
import { WorkMapDischarges, type ProgressSend } from './WorkMapDischarges';
import { WorkMapExport } from './WorkMapExport';
import { ShareProgress } from './ShareProgress';
import { WorkMapFilters, WorkMapLegend } from './WorkMapFilters';
import { BoardSheet } from './BoardSheet';
import { LayersButton, MAP_SHADOW } from './MapFloating';
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
import { ServiceCroquisScreen } from './ServiceCroquis';
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

function FullMap(props: { view: WorkMapView; labels: StationMark[]; open: boolean; onClose: () => void; pins: DischargePin[]; stretches: WorkMapLine[]; pending: WorkMapLine[]; stations: StationMark[]; bare: WorkMapLine[]; photos: PhotoLayer; marks: readonly WorkMapMark[]; observations: readonly WorkMapObservation[]; picks: MapPicks }) {
  const colors = useColores();
  const margins = useMargenes();
  const { picks } = props;
  return (
    <Modal visible={props.open} animationType="slide" onRequestClose={props.onClose}>
      <View className="flex-1 bg-background">
        {props.open ? <WorkMapSurface view={props.view} labels={props.labels} moves controlsInset={margins.pie} stations={props.stations} bare={props.bare} marks={props.marks} observations={props.observations} onPick={picks.pickOnMap} startAt={picks.startAt} pins={props.photos.shown ? props.photos.pins : props.pins} onPin={props.photos.shown ? props.photos.openPin : undefined} stretches={props.stretches} pending={props.pending} /> : null}
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
const NO_ROWS: LayerStreetSummary[] = [];

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

type FloatingProps = { /** The strip of layers (ma01). */ layerChips: ReactNode; notice?: string | null; layersOpen: boolean; onLayers: () => void; onMore: (key: MapMoreKey) => void; draws: boolean; edits: boolean; admin: boolean; /** «Registrar avance» in «Más» only when no layer sheet carries it. */ record: boolean };

/**
 * The top of the map (design ma01, José 28/11): ONE row of compact layer chips with «Más» beside
 * it, and the floating «Capas» under «Más». The cut, the work, the days and the legend live in
 * «Capas y leyenda»; «Editar croquis» and «Modo avance» in «Más». Nothing floats at the foot.
 */
function MapTop(props: FloatingProps) {
  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 top-3 gap-2">
      <View pointerEvents="box-none" className="flex-row items-center gap-1 pr-3">
        <View pointerEvents="box-none" className="min-w-0 flex-1">{props.layerChips}</View>
        <MapMoreMenu onPick={props.onMore} draws={props.draws} edits={props.edits} admin={props.admin} share screen="open" fieldTools record={props.record} />
      </View>
      <View pointerEvents="box-none" className="flex-row items-start justify-between gap-2 px-3">
        {props.notice ? <Text testID="mapa-aviso" accessibilityRole="alert" className="min-w-0 flex-1 self-start rounded-xl border border-primary/30 bg-surface px-3 py-2 text-[14px] font-semibold text-on-surface" style={MAP_SHADOW}>{props.notice}</Text> : <View className="flex-1" />}
        <LayersButton open={props.layersOpen} onToggle={props.onLayers} />
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
  // Design ma01 (José 28/11): the layer's peek opens with the map; «Capas y leyenda» only from its button.
  const [sheet, setSheet] = useState<MapSheet>(() => initialMapSheet(props.map.works.length));
  const [croquisOpen, setCroquisOpen] = useState(false);
  const [chosenLayer, setChosenLayer] = useState<string | null>(null);
  // The work picked in the map's select is the active layer too, so the sheet and the map agree.
  const layer = useMemo(() => activeLayerOf(map, byApprove.list, filter.workId ?? chosenLayer, limaDayKey(new Date()), filter), [map, byApprove.list, filter, chosenLayer]);
  const pickLayer = (id: string) => { setChosenLayer(id); setSheet(sheetForLayerPick); if (filter.workId) setFilter(workMapWorkFilter(filter, id)); };
  const { amplia } = useDisposicion();
  const [avance, setAvance] = useState<{ workId: string | null } | null>(null);
  const target = useMemo(() => progressTargetOf(map), [map]);
  const openStreet = (id: string | null, record = false, draft?: ManualProgressDraft) => { setRecordingStart(record); setRecordDraft(draft); setStreetId(id); };
  // No street to frame: the map frames the photos and the units (Portal via José 09/11).
  const view = useMemo(() => withMediaBounds(workMapView(map, filter), props.mapPhotos ?? NO_MAP_PHOTOS, props.discharges ?? NO_DISCHARGES), [map, filter, props.mapPhotos, props.discharges]);
  const groups = useMemo(() => workMapStageGroups(map, view), [map, view]);
  const stations = useMemo(() => visibleStationMarks(map.streets, view.streets.map((street) => street.id)), [map, view]);
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
  const lines = useMemo(() => layerMapLinesOf({ map, view: drawn.view, filter, workId: layer.workId, rows: layer.summary?.streets ?? NO_ROWS, hidden: Boolean(layer.workId && mapLayers.layers.works.includes(layer.workId)) }), [map, drawn.view, filter, layer, mapLayers.layers]);
  const layered = useMemo(() => ({ ...drawn.view, planned: lines.planned, done: lines.done }), [drawn.view, lines]);
  // «Hasta hoy», the work and the days moved here from the top of the map (José 28/11), with the legend.
  const controls = <View className="gap-3 pt-1"><WorkMapFilters map={map} view={view} filter={filter} onFilter={setFilter} /><MapDayChips options={mapDays.options} day={mapDays.day} onDay={mapDays.setDay} /><WorkMapLegend view={view} waiting={waiting} /></View>;
  const layersNode = <MapLayersPanel map={map} view={view} filter={filter} onFilter={setFilter} layers={mapLayers.layers} onToggle={mapLayers.toggle} controls={controls} photos={photos.available ? { count: photos.count, shown: photos.shown, onToggle: () => photos.setShown(!photos.shown), reports: photos.reports, onToggleReport: photos.toggleReport } : undefined} />;
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
    else if (key === 'record') record?.();
    else if (key === 'avance') setAvance({ workId: layer.workId });
    else if (key === 'croquis') setCroquisOpen(true);
    else setSeeingDeleted(true);
  };
  const record = props.editMap && target.kind !== 'none' ? () => setRecording({ streetId: target.kind === 'street' ? target.streetId : null, workId: layer.workId }) : undefined;
  const { summary } = layer;
  const layerSheet = summary ? (expanded: boolean) => <LayerSheet summary={summary} latest={layer.latest} badge={props.badge} onRecord={record} expanded={expanded} onExpand={amplia ? undefined : () => setSheet(expandLayerSheet)} /> : null;
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
  const panel = <BoardSheet sheet={sheet} side={amplia} onSheet={setSheet} layerSheet={layerSheet} layers={layersNode} panel={(head) => <WorkMapPanel head={head} view={view} groups={groups} filter={filter} badge={props.badge} top={top} items={picks.items} deleteStreet={props.deleteStreet} onOpenStreet={(id) => openStreet(id)} />} />;
  return (
    <View testID="mapa-servicio" className="flex-1">
      {wide ? null : picks.files.viewer}
      <View className="flex-1 flex-row">
      <View className="flex-1 overflow-hidden bg-surface-variant">
        {wide ? null : <WorkMapSurface view={layered} moves stations={stations} bare={lines.base} labels={lines.labels} marks={drawn.marks} observations={drawn.observations} onPick={picks.pickOnMap} pins={photos.shown ? photos.pins : unitPins} onPin={photos.shown ? photos.openPin : undefined} stretches={stretches} pending={pendingLines} />}
        {picks.card && !wide ? (
          <View className="absolute inset-x-3 bottom-20 items-center">
            <View style={{ width: '100%', maxWidth: CARD_MAX_WIDTH }}><MapCardView card={picks.card} onClose={picks.close} onPhoto={(photo, all) => picks.files.open(photo, all)} /></View>
          </View>
        ) : null}
        <MapTop layerChips={<LayerChips testPrefix="mapa-capa" chips={layer.chips} onPick={pickLayer} />} notice={props.notice} layersOpen={sheet === 'layers'} onLayers={() => setSheet(toggleLayersSheet)} onMore={more} draws={Boolean(props.onDraw)} edits={Boolean(props.editMap)} admin={Boolean(props.admin)} record={Boolean(record) && !summary} />
        {amplia ? null : panel}
      </View>
      {amplia ? panel : null}
      </View>
      <FullMap view={layered} labels={lines.labels} open={wide} onClose={closeFull} pins={unitPins} stretches={stretches} pending={pendingLines} stations={stations} bare={lines.base} photos={photos} marks={drawn.marks} observations={drawn.observations} picks={picks} />
      {props.editMap ? <DeletedWork open={seeingDeleted} map={map} send={props.editMap} onClose={() => setSeeingDeleted(false)} /> : null}
      <StreetScopes map={map} streetId={streetId} send={props.editMap} uploadPhoto={props.uploadPhoto} startRecording={recordingStart} recordDraft={recordDraft} onClose={() => openStreet(null)} />
      {props.editMap && recording ? <ManualProgress map={map} streetId={recording.streetId} send={props.editMap} uploadPhoto={props.uploadPhoto} workId={recording.workId} onDone={() => { setRecording(null); byApprove.reload(); }} /> : null}
      <WorkMapExport open={side === 'export'} map={map} filter={filter} onFilter={setFilter} title={props.title} pageUrl={pageUrl} send={props.editMap} uploadTrace={props.uploadTrace} onClose={() => setSide(null)} />
      {props.editMap ? <WorkLayersSheet kind={layers} map={map} send={props.editMap} onBrush={(picked) => { setBrush({ brush: picked, from: layers ?? 'stages' }); setLayers(null); }} onNewLayer={() => { setLayers(null); setNewLayer(true); }} onClose={() => setLayers(null)} /> : null}
      {props.editMap ? <NewLayerSheet open={newLayer} map={map} send={props.editMap} onCreated={layerCreated} onClose={() => setNewLayer(false)} /> : null}
      {props.editMap && brush ? <BrushMap map={map} send={props.editMap} brush={brush.brush} onDone={brushDone} /> : null}
      {props.editMap && avance ? <AvanceMode map={map} filter={filter} title={props.title} send={props.editMap} byApprove={byApprove.list} onUndo={byApprove.undo} initialWorkId={avance.workId} onPaint={(id) => { setAvance(null); setBrush({ brush: { kind: 'work', id }, from: 'avance' }); }} onExit={() => setAvance(null)} /> : null}
      {props.editMap && croquisOpen ? <ServiceCroquisScreen send={props.editMap} title={props.title} onClose={() => { setCroquisOpen(false); props.reload?.(); }} /> : null}
      <ShareProgress open={side === 'share'} map={map} filter={filter} onFilter={setFilter} send={props.editMap} mapInReport={props.mapInReport} onClose={() => setSide(null)} />
    </View>
  );
}

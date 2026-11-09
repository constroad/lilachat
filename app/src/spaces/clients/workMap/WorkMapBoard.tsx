import { useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { ArchiveRestore, ChevronRight, Download, ExternalLink, Layers, Maximize2, Paintbrush, Plus, Share2, TrendingUp, X } from 'lucide-react-native';
import { bareLinesOf, visibleStationMarks, progressTargetOf, type Brush, type ProgressTarget, type ManualPhotoUpload, type MapEditSend, type TraceUpload, type ServiceMapInReport, dischargePinsOf, withPendingLines, type PendingProgress, stretchLinesOf, suggestDischarges, workMapStageGroups, workMapView, type DischargePin, type StationMark, type StretchRange, type UnitDischarge, type MapPhoto, type ManualProgressDraft, type WorkMapLine, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
import { Sheet } from '../../../ui/Sheet';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';
import { WorkMapDischarges, type ProgressSend } from './WorkMapDischarges';
import { WorkMapExport } from './WorkMapExport';
import { ShareProgress } from './ShareProgress';
import { WorkMapFilters, WorkMapLegend } from './WorkMapFilters';
import { WorkMapPanel } from './WorkMapPanel';
import type { StreetDeleteSend } from './StreetDelete';
import type { PhotoAsset } from './ManualProgress';
import type { TraceFile } from '../useDriveUpload';
import { StreetScopes } from './StreetScopes';
import { DeletedWork } from './DeletedWork';
import { WorkMapSurface } from './WorkMapSurface';
import { BrushMap, WorkLayersSheet, type LayersKind } from './WorkLayers';
import { PhotoToggle, usePhotoLayer } from './MapPhotos';
import { PrimeCoatSuggestions } from './PrimeCoat';
import { PendingProgressCard } from './PendingProgress';

type PhotoLayer = ReturnType<typeof usePhotoLayer>;

function FullMap(props: { view: WorkMapView; open: boolean; onClose: () => void; pins: DischargePin[]; stretches: WorkMapLine[]; stations: StationMark[]; bare: WorkMapLine[]; photos: PhotoLayer }) {
  const colors = useColores();
  const margins = useMargenes();
  return (
    <Modal visible={props.open} animationType="slide" onRequestClose={props.onClose}>
      <View className="flex-1 bg-background">
        {props.open ? <WorkMapSurface view={props.view} moves controlsInset={margins.pie} stations={props.stations} bare={props.bare} pins={props.photos.shown ? props.photos.pins : props.pins} onPin={props.photos.shown ? props.photos.openPin : undefined} stretches={props.stretches} /> : null}
        {props.photos.available ? <PhotoToggle shown={props.photos.shown} count={props.photos.count} onToggle={() => props.photos.setShown(!props.photos.shown)} style={{ bottom: margins.pie + 24 }} /> : null}
        <Pressable testID="mapa-cerrar-completo" accessibilityLabel="Cerrar el mapa" onPress={props.onClose} className="absolute right-3 h-12 w-12 items-center justify-center rounded-full bg-surface" style={{ top: margins.cabecera + 8 }}>
          <X size={22} color={colors['on-surface']} />
        </Pressable>
      </View>
      {props.photos.viewer}
    </Modal>
  );
}

const NO_DISCHARGES: UnitDischarge[] = [];

/** The units of the Control de pista over the map: the suggestion, its pins and the stretches being confirmed. */
function useDischarges(map: WorkMap, discharges: UnitDischarge[]) {
  const suggestion = useMemo(() => suggestDischarges(map, discharges), [map, discharges]);
  const [ranges, setRanges] = useState<Record<string, StretchRange>>({});
  const pins = useMemo(() => dischargePinsOf(suggestion), [suggestion]);
  const stretches = useMemo(() => stretchLinesOf(map, suggestion.stretches, ranges), [map, suggestion, ranges]);
  return { suggestion, ranges, pins, stretches, onRange: (streetId: string, range: StretchRange) => setRanges((before) => ({ ...before, [streetId]: range })) };
}

type BoardProps = { map: WorkMap; pageUrl: string; height: number; title: string; serviceId: string; /** The service's state beside «Avance de la obra». */ badge?: ReactNode; discharges?: UnitDischarge[]; /** Field photos with their place: the «Fotos» layer (José 08/11). */ mapPhotos?: MapPhoto[]; send?: ProgressSend; /** «Nueva calle» (o-02). */ onDraw?: () => void; /** «Borrar calle»: anyone, logical (José 07/11). */ deleteStreet?: StreetDeleteSend; /** Stretches, stages and works (o-03 to o-05). */ editMap?: MapEditSend; /** A space admin: «Borrados» and «Restaurar» (José 07/11). */ admin?: boolean; /** Photos of «Registrar avance» (o-06). */ uploadPhoto?: ManualPhotoUpload<PhotoAsset>; /** KMZ or KML for «Importar» (o-12). */ uploadTrace?: TraceUpload<TraceFile>; /** «Incluir en el informe» as Portal has it. */ mapInReport?: ServiceMapInReport; /** What the last save answered, over the map. */ notice?: string | null };

/** «¿En qué calle?» when «Registrar avance» could go to several streets. */
function StreetPick(props: { target: ProgressTarget | null; onPick: (streetId: string) => void; onClose: () => void }) {
  const colors = useColores();
  const streets = props.target?.kind === 'choose' ? props.target.streets : [];
  return (
    <Sheet visible={streets.length > 0} onClose={props.onClose} testID="avance-elegir-calle" className="gap-2 px-4 pt-2">
      <Text className="text-[12px] font-bold uppercase tracking-[1.5px] text-primary">Registrar avance</Text>
      <Text className="mb-1 text-[22px] font-bold text-on-surface">¿En qué calle?</Text>
      {streets.map((street) => (
        <Pressable key={street.id} testID={`avance-calle-${street.id}`} onPress={() => props.onPick(street.id)} className="min-h-[56px] flex-row items-center justify-between rounded-xl border border-outline/20 bg-surface px-4">
          <Text className="flex-1 text-[16px] font-semibold text-on-surface">{street.name}</Text>
          <ChevronRight size={18} color={colors['on-surface-variant']} />
        </Pressable>
      ))}
    </Sheet>
  );
}

function TitleRow(props: { pageUrl: string; onExport: () => void; onShare: () => void; onDraw?: () => void; onDeleted?: () => void }) {
  const colors = useColores();
  return (
    <View className="gap-2">
      <Text className="text-[20px] font-bold text-on-surface">Mapa de la obra</Text>
      <View className="flex-row items-center justify-end gap-2">
        {props.onDraw ? (
          <Pressable testID="mapa-nueva-calle" accessibilityLabel="Nueva calle" onPress={props.onDraw} className="h-11 w-11 items-center justify-center rounded-xl border border-outline/20">
            <Plus size={18} color={colors['on-surface']} />
          </Pressable>
        ) : null}
        {props.onDeleted ? (
          <Pressable testID="mapa-borrados-abrir" accessibilityLabel="Borrados" onPress={props.onDeleted} className="h-11 w-11 items-center justify-center rounded-xl border border-outline/20">
            <ArchiveRestore size={18} color={colors['on-surface']} />
          </Pressable>
        ) : null}
        <Pressable testID="mapa-abrir" accessibilityLabel="Abrir en Portal" onPress={() => void Linking.openURL(props.pageUrl)} className="h-11 w-11 items-center justify-center rounded-xl border border-outline/20">
          <ExternalLink size={18} color={colors['on-surface']} />
        </Pressable>
        <Pressable testID="mapa-exportar" accessibilityLabel="Exportar" onPress={props.onExport} className="h-11 w-11 items-center justify-center rounded-xl border border-outline/20">
          <Download size={18} color={colors['on-surface']} />
        </Pressable>
        <Pressable testID="mapa-compartir" onPress={props.onShare} className="h-11 flex-row items-center gap-2 rounded-xl bg-primary px-3">
          <Share2 size={18} color={colors['on-primary']} />
          <Text className="text-[15px] font-semibold text-on-primary">Compartir</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** «Etapas» and «Trabajos» under «Registrar avance» (o-04, o-05): the title row has no room left. */
function LayerButtons(props: { onOpen: (kind: LayersKind) => void }) {
  const colors = useColores();
  return (
    <View className="flex-row gap-2">
      <Pressable testID="mapa-etapas-abrir" onPress={() => props.onOpen('stages')} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-outline/25 bg-surface">
        <Layers size={18} color={colors['on-surface']} /><Text className="text-[15px] font-semibold text-on-surface">Etapas</Text>
      </Pressable>
      <Pressable testID="mapa-trabajos-abrir" onPress={() => props.onOpen('works')} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-outline/25 bg-surface">
        <Paintbrush size={18} color={colors['on-surface']} /><Text className="text-[15px] font-semibold text-on-surface">Trabajos</Text>
      </Pressable>
    </View>
  );
}

/**
 * The map of the work as the design's phone draws it (`o-01-mapa-obra`): title and «Compartir»,
 * stage and day, the works, the map edge to edge, and the panel rising over it like a sheet.
 * «Compartir» opens the export (`o-12`); the corner button opens the map that moves.
 */
export function WorkMapBoard(props: BoardProps) {
  const { map, pageUrl, height } = props;
  const colors = useColores();
  const [filter, setFilter] = useState<WorkMapFilter>({});
  const [wide, setWide] = useState(false);
  const [side, setSide] = useState<'export' | 'share' | null>(null);
  const [streetId, setStreetId] = useState<string | null>(null);
  const [seeingDeleted, setSeeingDeleted] = useState(false);
  const [recordingStart, setRecordingStart] = useState(false);
  const [recordDraft, setRecordDraft] = useState<ManualProgressDraft | undefined>(undefined);
  const [choosing, setChoosing] = useState<ProgressTarget | null>(null);
  const [layers, setLayers] = useState<LayersKind | null>(null);
  const [brush, setBrush] = useState<{ brush: Brush; from: LayersKind } | null>(null);
  const target = useMemo(() => progressTargetOf(map), [map]);
  const openStreet = (id: string | null, record = false, draft?: ManualProgressDraft) => { setChoosing(null); setRecordingStart(record); setRecordDraft(draft); setStreetId(id); };
  const view = useMemo(() => workMapView(map, filter), [map, filter]);
  const groups = useMemo(() => workMapStageGroups(map, view), [map, view]);
  const stations = useMemo(() => visibleStationMarks(map.streets, view.streets.map((street) => street.id)), [map, view]);
  const bare = useMemo(() => bareLinesOf({ streets: map.streets.filter((street) => view.streets.some((shown) => shown.id === street.id)), scopes: map.scopes }), [map, view]);
  const pista = useDischarges(map, props.discharges ?? NO_DISCHARGES);
  const photos = usePhotoLayer(map, props.mapPhotos);
  const [pendingItems, setPendingItems] = useState<PendingProgress[]>([]);
  const stretches = useMemo(() => withPendingLines(map, pista.stretches, pendingItems), [map, pista.stretches, pendingItems]);
  const discharges = pista.suggestion.units.length ? <WorkMapDischarges map={map} serviceId={props.serviceId} suggestion={pista.suggestion} send={props.send} ranges={pista.ranges} onRange={pista.onRange} /> : null;
  const primeCoat = props.editMap && props.mapPhotos?.length ? <PrimeCoatSuggestions map={map} photos={props.mapPhotos} onRecord={(id, draft) => openStreet(id, true, draft)} /> : null;
  // José 09/11: what was sent waits here until approved, instead of vanishing. It is drawn over its street too.
  const pending = props.editMap ? <PendingProgressCard send={props.editMap} admin={Boolean(props.admin)} reloadKey={map} onList={setPendingItems} /> : null;
  const top = discharges || primeCoat || pending ? <View className="gap-5">{pending}{discharges}{primeCoat}</View> : null;
  return (
    <View testID="mapa-servicio" className="gap-3">
      <TitleRow pageUrl={pageUrl} onExport={() => setSide('export')} onShare={() => setSide('share')} onDraw={props.onDraw} onDeleted={props.admin && props.editMap ? () => setSeeingDeleted(true) : undefined} />
      {props.editMap && target.kind !== 'none' ? (
        <Pressable testID="mapa-registrar-avance" onPress={() => (target.kind === 'street' ? openStreet(target.streetId, true) : setChoosing(target))} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-primary">
          <TrendingUp size={18} color={colors['on-primary']} />
          <Text className="text-[16px] font-semibold text-on-primary">Registrar avance</Text>
        </Pressable>
      ) : null}
      {props.editMap ? <LayerButtons onOpen={setLayers} /> : null}
      <WorkMapFilters map={map} view={view} filter={filter} onFilter={setFilter} />
      <WorkMapLegend view={view} />
      {props.notice ? <Text testID="mapa-aviso" accessibilityRole="alert" className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[14px] font-semibold text-on-surface">{props.notice}</Text> : null}
      <View className="-mx-4 overflow-hidden bg-surface-variant" style={{ height }}>
        <View pointerEvents="none" className="absolute inset-0">
          {wide ? null : <WorkMapSurface view={view} moves={false} stations={stations} bare={bare} pins={photos.shown ? photos.pins : pista.pins} stretches={stretches} />}
        </View>
        {/* The small map does not take taps: «Fotos» opens the full one, where a marker opens its photos. */}
        {photos.available ? <PhotoToggle shown={photos.shown} count={photos.count} onToggle={() => { photos.setShown(true); setWide(true); }} style={{ bottom: 16 }} /> : null}
        <Pressable testID="mapa-pantalla-completa" accessibilityLabel="Ver mapa completo" onPress={() => setWide(true)} className="absolute right-3 top-3 h-11 w-11 items-center justify-center rounded-xl border border-outline/15 bg-surface">
          <Maximize2 size={18} color={colors['on-surface']} />
        </Pressable>
      </View>
      <WorkMapPanel view={view} groups={groups} filter={filter} badge={props.badge} top={top} deleteStreet={props.deleteStreet} onOpenStreet={(id) => openStreet(id)} />
      <FullMap view={view} open={wide} onClose={() => setWide(false)} pins={pista.pins} stretches={stretches} stations={stations} bare={bare} photos={photos} />
      {props.editMap ? <DeletedWork open={seeingDeleted} map={map} send={props.editMap} onClose={() => setSeeingDeleted(false)} /> : null}
      <StreetScopes map={map} streetId={streetId} send={props.editMap} uploadPhoto={props.uploadPhoto} startRecording={recordingStart} recordDraft={recordDraft} onClose={() => openStreet(null)} />
      <StreetPick target={choosing} onPick={(id) => openStreet(id, true)} onClose={() => setChoosing(null)} />
      <WorkMapExport open={side === 'export'} map={map} filter={filter} onFilter={setFilter} title={props.title} pageUrl={pageUrl} send={props.editMap} uploadTrace={props.uploadTrace} onClose={() => setSide(null)} />
      {props.editMap ? <WorkLayersSheet kind={layers} map={map} send={props.editMap} onBrush={(picked) => { setBrush({ brush: picked, from: layers ?? 'stages' }); setLayers(null); }} onClose={() => setLayers(null)} /> : null}
      {props.editMap && brush ? <BrushMap map={map} send={props.editMap} brush={brush.brush} onDone={() => { setLayers(brush.from); setBrush(null); }} /> : null}
      <ShareProgress open={side === 'share'} map={map} filter={filter} onFilter={setFilter} send={props.editMap} mapInReport={props.mapInReport} onClose={() => setSide(null)} />
    </View>
  );
}

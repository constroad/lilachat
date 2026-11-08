import { useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { ArchiveRestore, Download, ExternalLink, Maximize2, Plus, Share2, X } from 'lucide-react-native';
import { type ManualPhotoUpload, type MapEditSend, type TraceUpload, type ServiceMapInReport, dischargePinsOf, stretchLinesOf, suggestDischarges, workMapStageGroups, workMapView, type DischargePin, type StretchRange, type UnitDischarge, type WorkMapLine, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
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

function FullMap(props: { view: WorkMapView; open: boolean; onClose: () => void; pins: DischargePin[]; stretches: WorkMapLine[] }) {
  const colors = useColores();
  const margins = useMargenes();
  return (
    <Modal visible={props.open} animationType="slide" onRequestClose={props.onClose}>
      <View className="flex-1 bg-background">
        {props.open ? <WorkMapSurface view={props.view} moves pins={props.pins} stretches={props.stretches} /> : null}
        <Pressable testID="mapa-cerrar-completo" accessibilityLabel="Cerrar el mapa" onPress={props.onClose} className="absolute right-3 h-12 w-12 items-center justify-center rounded-full bg-surface" style={{ top: margins.cabecera + 8 }}>
          <X size={22} color={colors['on-surface']} />
        </Pressable>
      </View>
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

type BoardProps = { map: WorkMap; pageUrl: string; height: number; title: string; serviceId: string; /** The service's state beside «Avance de la obra». */ badge?: ReactNode; discharges?: UnitDischarge[]; send?: ProgressSend; /** «Nueva calle» (o-02). */ onDraw?: () => void; /** «Borrar calle»: anyone, logical (José 07/11). */ deleteStreet?: StreetDeleteSend; /** Stretches, stages and works (o-03 to o-05). */ editMap?: MapEditSend; /** A space admin: «Borrados» and «Restaurar» (José 07/11). */ admin?: boolean; /** Photos of «Registrar avance» (o-06). */ uploadPhoto?: ManualPhotoUpload<PhotoAsset>; /** KMZ or KML for «Importar» (o-12). */ uploadTrace?: TraceUpload<TraceFile>; /** «Incluir en el informe» as Portal has it. */ mapInReport?: ServiceMapInReport };

function TitleRow(props: { pageUrl: string; onExport: () => void; onShare: () => void; onDraw?: () => void; onDeleted?: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-2">
      <Text className="min-w-0 flex-1 text-[20px] font-bold text-on-surface">Mapa de la obra</Text>
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
  const view = useMemo(() => workMapView(map, filter), [map, filter]);
  const groups = useMemo(() => workMapStageGroups(map, view), [map, view]);
  const pista = useDischarges(map, props.discharges ?? NO_DISCHARGES);
  const top = pista.suggestion.units.length ? <WorkMapDischarges map={map} serviceId={props.serviceId} suggestion={pista.suggestion} send={props.send} ranges={pista.ranges} onRange={pista.onRange} /> : null;
  return (
    <View testID="mapa-servicio" className="gap-3">
      <TitleRow pageUrl={pageUrl} onExport={() => setSide('export')} onShare={() => setSide('share')} onDraw={props.onDraw} onDeleted={props.admin && props.editMap ? () => setSeeingDeleted(true) : undefined} />
      <WorkMapFilters map={map} view={view} filter={filter} onFilter={setFilter} />
      <View className="-mx-4 overflow-hidden bg-surface-variant" style={{ height }}>
        <View pointerEvents="none" className="absolute inset-0">
          {wide ? null : <WorkMapSurface view={view} moves={false} pins={pista.pins} stretches={pista.stretches} />}
        </View>
        <WorkMapLegend view={view} />
        <Pressable testID="mapa-pantalla-completa" accessibilityLabel="Ver mapa completo" onPress={() => setWide(true)} className="absolute right-3 top-3 h-11 w-11 items-center justify-center rounded-xl border border-outline/15 bg-surface">
          <Maximize2 size={18} color={colors['on-surface']} />
        </Pressable>
      </View>
      <WorkMapPanel view={view} groups={groups} filter={filter} badge={props.badge} top={top} deleteStreet={props.deleteStreet} onOpenStreet={setStreetId} />
      <FullMap view={view} open={wide} onClose={() => setWide(false)} pins={pista.pins} stretches={pista.stretches} />
      {props.editMap ? <DeletedWork open={seeingDeleted} map={map} send={props.editMap} onClose={() => setSeeingDeleted(false)} /> : null}
      <StreetScopes map={map} streetId={streetId} send={props.editMap} uploadPhoto={props.uploadPhoto} onClose={() => setStreetId(null)} />
      <WorkMapExport open={side === 'export'} map={map} filter={filter} onFilter={setFilter} title={props.title} pageUrl={pageUrl} send={props.editMap} uploadTrace={props.uploadTrace} onClose={() => setSide(null)} />
      <ShareProgress open={side === 'share'} map={map} filter={filter} onFilter={setFilter} send={props.editMap} mapInReport={props.mapInReport} onClose={() => setSide(null)} />
    </View>
  );
}

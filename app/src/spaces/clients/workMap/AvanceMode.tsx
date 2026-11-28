import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft, Pointer } from 'lucide-react-native';
import { AVANCE_MANUAL_HINT, AVANCE_MANUAL_ONE, AVANCE_PICK_STREET, AVANCE_TITLE, addManualMark, avanceLinesOf, avanceStreetAtTap, manualHandlesOf, manualRangeOf, measureOnStreet, moveManualMark, tapReachM, type StreetEnd, avanceChipsOf, avanceHint, avancePickedWork, avanceTargetOf, undoableOf, type ByApproveList, workMapView, layerMapLinesOf, type MapEditSend, type WorkMap, type WorkMapFilter, type WorkMapPoint } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';
import { NewLayerSheet } from './NewLayer';
import { LayerChips } from './LayerChips';
import { MAP_SHADOW } from './MapFloating';
import { AvancePanel } from './AvancePanel';
import { WorkMapSurface } from './WorkMapSurface';

function Head(props: { title: string; onExit: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-3 px-3">
      <Pressable testID="avance-salir" accessibilityLabel="Salir del modo avance" onPress={props.onExit} className="h-12 w-12 items-center justify-center rounded-full bg-surface" style={MAP_SHADOW}>
        <ArrowLeft size={22} color={colors['on-surface']} />
      </Pressable>
      <View className="min-w-0 flex-1 rounded-2xl bg-surface/90 px-3 py-1">
        <Text numberOfLines={1} className="font-mono text-[12px] font-bold uppercase tracking-[1.5px] text-primary">{props.title}</Text>
        <Text className="text-[20px] font-bold text-on-surface">{AVANCE_TITLE}</Text>
      </View>
    </View>
  );
}

/** The hint, one line where it fits (José 28/11: «está grandazo»). */
function Hint(props: { text: string; error: string | null }) {
  const colors = useColores();
  return (
    <View testID="avance-pista" className="mx-3 flex-row items-center gap-2 self-start rounded-full bg-surface/95 px-3 py-2" style={MAP_SHADOW}>
      <Pointer size={16} color={colors.primary} />
      <Text numberOfLines={2} className={`flex-shrink text-[13px] font-semibold ${props.error ? 'text-error' : 'text-on-surface'}`}>{props.error ?? props.text}</Text>
    </View>
  );
}

/** «Marcar a mano» (José 28/11): two taps on the picked street set «desde» and «hasta»; the rings drag. */
const NO_FILTER = {};
const NO_ROWS: never[] = [];

export type ManualMarks = ReturnType<typeof useManualMarks>;

export function useManualMarks(map: WorkMap, streetId: string | null) {
  const [on, setOn] = useState(false);
  const [marks, setMarks] = useState<number[]>([]);
  const street = map.streets.find((one) => one.id === streetId);
  const range = on ? manualRangeOf(marks) : null;
  return {
    on, marks, range,
    handles: on ? manualHandlesOf(street, marks) : [],
    toggle: () => { setOn(!on); setMarks([]); },
    reset: () => setMarks([]),
    tap: (place: WorkMapPoint) => { if (street) setMarks(addManualMark(marks, measureOnStreet(street, place))); },
    drop: (handle: StreetEnd, place: WorkMapPoint) => { if (street) setMarks(moveManualMark(marks, handle, measureOnStreet(street, place))); },
  };
}

/**
 * «Modo Avance» on the phone (design av-01, José 27/11): the strip of works on top, a tap on a
 * street opens its panel, and «Guardar avance» sends it to wait for an admin's approval.
 */
export function AvanceMode(props: { map: WorkMap; /** The board's stage and day cut: the chips' % as everywhere else. */ filter: WorkMapFilter; title: string; send: MapEditSend; byApprove: ByApproveList | null; onUndo: (id: string) => Promise<string | null>; onExit: () => void; /** The work picked on entering: the layer just created (ma03). */ initialWorkId?: string | null; /** «Nueva capa» with the switch off: the brush, outside this mode. */ onPaint: (workId: string) => void }) {
  const { map } = props;
  const margins = useMargenes();
  const [chosen, setChosen] = useState<string | null>(props.initialWorkId ?? null);
  const [streetId, setStreetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLayer, setNewLayer] = useState(false);
  const created = (id: string, paint: boolean) => {
    setNewLayer(false);
    if (paint) return props.onPaint(id);
    setChosen(id);
    setStreetId(null);
  };
  const workId = avancePickedWork(map, chosen);
  const chips = useMemo(() => avanceChipsOf(map, workId, props.filter), [map, workId, props.filter]);
  // The map by layer as on the board (José 28/11): the picked work solid in its colour, the rest faint and neutral.
  const whole = useMemo(() => workMapView(map), [map]);
  const lines = useMemo(() => layerMapLinesOf({ map, view: whole, filter: NO_FILTER, workId, rows: NO_ROWS, hidden: false }), [map, whole, workId]);
  const view = useMemo(() => ({ ...whole, planned: lines.planned, done: lines.done }), [whole, lines]);
  const target = workId && streetId ? avanceTargetOf(map, streetId, workId) : null;
  const workName = chips.find((chip) => chip.selected)?.name ?? '';
  const manual = useManualMarks(map, streetId);
  // A short patch on a long road is hard to hit: the reach grows as the map zooms out (José 28/11).
  const tap = (place: WorkMapPoint, _roads?: unknown, zoom?: number) => {
    if (manual.on && target) return manual.tap(place);
    const found = avanceStreetAtTap(map, place, tapReachM(zoom, place.lat));
    setError(found ? null : AVANCE_PICK_STREET);
    if (found && found !== streetId) { setStreetId(found); manual.reset(); }
  };
  const hint = manual.on && target ? (manual.marks.length === 1 ? AVANCE_MANUAL_ONE : AVANCE_MANUAL_HINT) : avanceHint(workName);
  return (
    <Modal visible animationType="slide" onRequestClose={props.onExit}>
      <View testID="avance-modo" className="flex-1 bg-background">
        <WorkMapSurface view={view} bare={lines.base} moves controlsInset={margins.pie} stretches={avanceLinesOf(map, workId, streetId, manual.range)} onTap={workId ? tap : undefined} handles={manual.handles} onHandleDrop={manual.drop} />
        <View pointerEvents="box-none" className="absolute inset-x-0 gap-3" style={{ top: margins.cabecera + 8 }}>
          <Head title={props.title} onExit={props.onExit} />
          <LayerChips testPrefix="avance-trabajo" chips={chips} onPick={(id) => { setChosen(id); setError(null); }} onNewLayer={() => setNewLayer(true)} />
          {workId ? <Hint text={hint} error={error} /> : null}
        </View>
        {target ? <AvancePanel key={`${target.streetId}|${target.workId}`} map={map} target={target} send={props.send} undoable={undoableOf(props.byApprove, target.streetId, target.workId)} onUndo={props.onUndo} bottom={margins.pie} manual={manual} onClose={() => { setStreetId(null); manual.reset(); }} /> : null}
      </View>
      <NewLayerSheet open={newLayer} map={map} send={props.send} onCreated={created} onClose={() => setNewLayer(false)} />
    </Modal>
  );
}

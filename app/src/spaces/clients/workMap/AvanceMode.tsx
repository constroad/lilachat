import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft, Pointer } from 'lucide-react-native';
import { AVANCE_PICK_STREET, AVANCE_TITLE, avanceChipsOf, avanceHint, avancePickedWork, avanceTargetOf, brushLinesOf, byApproveLinesOf, undoableOf, type ByApproveList, stretchLineOf, streetAtTap, workMapView, type MapEditSend, type WorkMap, type WorkMapFilter, type WorkMapLine, type WorkMapPoint } from '@lilachat/shared';
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

function Hint(props: { text: string; error: string | null }) {
  const colors = useColores();
  return (
    <View testID="avance-pista" className="mx-3 flex-row items-center gap-3 rounded-full bg-surface/95 px-4 py-3" style={MAP_SHADOW}>
      <Pointer size={20} color={colors.primary} />
      <Text className={`flex-1 text-[14px] font-semibold ${props.error ? 'text-error' : 'text-on-surface'}`}>{props.error ?? props.text}</Text>
    </View>
  );
}

/** The work's stretches in its colour and the tapped street on top, in the stretch colour. */
function linesOf(map: WorkMap, workId: string | null, streetId: string | null): WorkMapLine[] {
  const own = workId ? brushLinesOf(map, { kind: 'work', id: workId }) : [];
  const street = map.streets.find((one) => one.id === streetId);
  const picked = street ? stretchLineOf(map, street.id, 0, street.lengthM) : null;
  return picked ? [...own, picked] : own;
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
  const view = useMemo(() => workMapView(map), [map]);
  const target = workId && streetId ? avanceTargetOf(map, streetId, workId) : null;
  const workName = chips.find((chip) => chip.selected)?.name ?? '';
  const pending = useMemo(() => byApproveLinesOf(map, props.byApprove).filter((one) => one.workId === workId), [map, props.byApprove, workId]);
  const tap = (place: WorkMapPoint) => {
    const found = streetAtTap(map, place);
    setError(found ? null : AVANCE_PICK_STREET);
    if (found) setStreetId(found);
  };
  return (
    <Modal visible animationType="slide" onRequestClose={props.onExit}>
      <View testID="avance-modo" className="flex-1 bg-background">
        <WorkMapSurface view={view} moves controlsInset={margins.pie} stretches={linesOf(map, workId, streetId)} pending={pending} onTap={workId ? tap : undefined} />
        <View pointerEvents="box-none" className="absolute inset-x-0 gap-3" style={{ top: margins.cabecera + 8 }}>
          <Head title={props.title} onExit={props.onExit} />
          <LayerChips testPrefix="avance-trabajo" chips={chips} onPick={(id) => { setChosen(id); setError(null); }} onNewLayer={() => setNewLayer(true)} />
          {workId ? <Hint text={avanceHint(workName)} error={error} /> : null}
        </View>
        {target ? <AvancePanel key={`${target.streetId}|${target.workId}`} map={map} target={target} send={props.send} undoable={undoableOf(props.byApprove, target.streetId, target.workId)} onUndo={props.onUndo} bottom={margins.pie} onClose={() => setStreetId(null)} /> : null}
      </View>
      <NewLayerSheet open={newLayer} map={map} send={props.send} onCreated={created} onClose={() => setNewLayer(false)} />
    </Modal>
  );
}

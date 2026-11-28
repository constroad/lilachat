import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Paintbrush, Plus, Undo2 } from 'lucide-react-native';
import { BRUSH_QUEUE_IDLE, brushLinesOf, brushTitle, createdOrRefusal, percentLabel, sendWorkStage, stageCardsOf, startBrushQueue, workMapView, workRowsOf, workStageRequest, type Brush, type MapEditSend, type StageCard, type WorkMap, type WorkRow } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';
import { PanelSheet, SHEET_LABEL } from './CutChips';
import { NewLabel } from './ScopeForm';
import { useLayerActions } from './LayerActions';
import { WorkMapSurface } from './WorkMapSurface';

export type LayersKind = 'stages' | 'works';
/** Air between the status bar and the brush band: at 8 it read stuck to the clock (APK E2E 08/11). */
const BAND_GAP = 20;

function BrushButton(props: { testID: string; label: string; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} onPress={props.onPress} className="h-11 flex-row items-center gap-1.5 rounded-xl border border-primary/30 px-3">
      <Paintbrush size={16} color={colors.primary} /><Text className="text-[14px] font-semibold text-primary">{props.label}</Text>
    </Pressable>
  );
}

function StageCardView(props: { card: StageCard; map: WorkMap; send: MapEditSend; onBrush: () => void }) {
  const { card } = props;
  const actions = useLayerActions({ kind: 'stages', id: card.id, name: card.name, layers: props.map.stages, send: props.send });
  return (
    <View testID={`etapa-${card.id}`} className="rounded-2xl border-[1.5px] border-outline/15 bg-surface p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1"><Text className="text-[16px] font-bold text-on-surface">{card.name}</Text><Text className="mt-0.5 font-mono text-[13px] text-on-surface-variant">{card.line}</Text></View>
        {actions.icons}
        <Text className="text-[24px] font-extrabold text-primary">{percentLabel(card.percent)}</Text>
      </View>
      {actions.panel}
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-outline/15"><View className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, card.percent)}%` }} /></View>
      <View className="mt-3 flex-row items-center justify-between gap-2 border-t border-outline/10 pt-3">
        <Text className="flex-1 text-[13px] text-on-surface-variant">{card.days}</Text>
        <BrushButton testID={`etapa-brocha-${card.id}`} label="Tocar calles" onPress={props.onBrush} />
      </View>
      {card.streets.length ? <View className="mt-2 flex-row flex-wrap gap-1.5">{card.streets.map((street) => <Text key={street.id} className="rounded-md border border-outline/20 px-2 py-0.5 text-[13px] text-on-surface">{street.name}</Text>)}</View> : null}
    </View>
  );
}

function WorkRowView(props: { row: WorkRow; map: WorkMap; send: MapEditSend; onBrush: () => void }) {
  const { row } = props;
  const actions = useLayerActions({ kind: 'works', id: row.id, name: row.name, layers: props.map.works, send: props.send });
  return (
    <View testID={`trabajo-fila-${row.id}`} className="rounded-2xl border-[1.5px] border-outline/15 bg-surface px-3 py-2.5">
      {/* The name takes the whole row (José 28/11: it was cut after a few letters); the actions go under it. */}
      <View className="flex-row items-center gap-3">
        <Text className="w-5 text-center font-mono text-[13px] font-bold text-on-surface-variant">{row.order}</Text>
        <View className="h-3 w-8 rounded-full" style={{ backgroundColor: row.color }} />
        <View className="flex-1"><Text testID={`trabajo-nombre-${row.id}`} numberOfLines={2} className="text-[15px] font-semibold text-on-surface">{row.name}</Text><Text numberOfLines={1} className="font-mono text-[13px] text-on-surface-variant">{row.line}</Text></View>
      </View>
      <View className="mt-1.5 flex-row items-center justify-end gap-2">
        {row.editable ? actions.icons : null}
        <BrushButton testID={`trabajo-brocha-${row.id}`} label="Pintar" onPress={props.onBrush} />
      </View>
      {row.editable ? actions.panel : null}
    </View>
  );
}

type SheetProps = { kind: LayersKind | null; map: WorkMap; send: MapEditSend; onBrush: (brush: Brush) => void; /** «Agregar trabajo» opens «Nueva capa» (ma03). */ onNewLayer: () => void; onClose: () => void };

/** «Agregar trabajo»: «Nueva capa» (design ma03) instead of a name field. */
export function NewLayerButton(props: { testID: string; label: string; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} onPress={props.onPress} className="h-11 flex-row items-center gap-1.5 self-start rounded-full border border-dashed border-primary/40 px-4">
      <Plus size={16} color={colors.primary} /><Text className="text-[15px] font-semibold text-primary">{props.label}</Text>
    </Pressable>
  );
}

/** «Etapas» (o-04) and «Trabajos» (o-05) on the phone: the cards, and the brush that opens the map. */
export function WorkLayersSheet(props: SheetProps) {
  const stages = props.kind === 'stages';
  const { cards, loose } = stageCardsOf(props.map);
  return (
    <PanelSheet open={props.kind !== null} onClose={props.onClose} testID={stages ? 'mapa-etapas' : 'mapa-trabajos'} keyboard="avoid">
      <View>
        <Text className="text-[12px] font-bold uppercase tracking-[1.5px] text-primary">{stages ? 'Partir la obra' : 'Qué se hace en cada calle'}</Text>
        <Text className="text-[22px] font-bold text-on-surface">{stages ? 'Etapas' : 'Trabajos'}</Text>
      </View>
      {stages ? cards.map((card) => <StageCardView key={card.id} card={card} map={props.map} send={props.send} onBrush={() => props.onBrush({ kind: 'stage', id: card.id })} />) : workRowsOf(props.map).map((row) => <WorkRowView key={row.id} row={row} map={props.map} send={props.send} onBrush={() => props.onBrush({ kind: 'work', id: row.id })} />)}
      {stages
        ? <NewLabel testID="etapa" placeholder="Nueva etapa" onCreate={(name) => createdOrRefusal(props.send(workStageRequest(name), sendWorkStage))} />
        : <NewLayerButton testID="trabajo-nueva" label="Agregar trabajo" onPress={props.onNewLayer} />}
      {stages && loose.length ? (
        <View testID="etapas-sin-etapa" className="rounded-2xl border border-dashed border-outline/30 p-3">
          <Text className={SHEET_LABEL}>Sin etapa · {loose.length} {loose.length === 1 ? 'calle' : 'calles'}</Text>
          <Text className="mt-1 text-[14px] text-on-surface-variant">{loose.map((street) => street.name).join(' · ')}</Text>
        </View>
      ) : null}
      {stages ? null : <Text className="text-[13px] text-on-surface-variant">Una calle sin un trabajo no cuenta como pendiente.</Text>}
    </PanelSheet>
  );
}

/** The brush's taps: painted at once, saved in order behind the map (José 28/11). */
function useStrokes(map: WorkMap, send: MapEditSend, brush: Brush) {
  const [snapshot, setSnapshot] = useState(BRUSH_QUEUE_IDLE);
  const door = useRef(send);
  door.current = send;
  const [queue] = useState(() => startBrushQueue({ brush, map, send: () => door.current, newEntryId: randomUUID, onChange: setSnapshot }));
  useEffect(() => {
    queue.mapChanged(map);
    return undefined;
  }, [queue, map]);
  return { ...snapshot, queue };
}

/** The map that moves, with the brush on: a tap toggles the street, the band says what is painted. */
export function BrushMap(props: { map: WorkMap; send: MapEditSend; brush: Brush; onDone: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const strokes = useStrokes(props.map, props.send, props.brush);
  const view = workMapView(props.map);
  return (
    <Modal visible animationType="slide" onRequestClose={props.onDone}>
      <View testID="mapa-brocha-completo" className="flex-1 bg-background">
        <WorkMapSurface view={view} moves controlsInset={margins.pie} stretches={brushLinesOf(strokes.queue.mapOf(props.map), props.brush)} onTap={strokes.queue.tap} />
        <View testID="mapa-brocha" className="absolute inset-x-3 rounded-2xl border border-primary/30 bg-surface p-3" style={{ top: margins.cabecera + BAND_GAP }}>
          <Text className="text-[15px] font-semibold text-on-surface">{brushTitle(props.map, props.brush)}</Text>
          {strokes.label ? <Text testID="brocha-cuenta" className="mt-0.5 text-[13px] text-on-surface-variant">{strokes.label}</Text> : null}
          {strokes.error ? <Text testID="brocha-error" className="mt-1 text-[13px] font-semibold text-error">{strokes.error}</Text> : null}
          <View className="mt-2 flex-row gap-2">
            <Pressable testID="brocha-deshacer" disabled={!strokes.canUndo} onPress={strokes.queue.undo} className={`h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-primary/30 ${strokes.canUndo ? '' : 'opacity-40'}`}>
              <Undo2 size={16} color={colors.primary} /><Text className="text-[15px] font-semibold text-primary">Deshacer</Text>
            </Pressable>
            <Pressable testID="brocha-listo" onPress={props.onDone} className="h-11 flex-1 items-center justify-center rounded-xl bg-primary"><Text className="text-[15px] font-semibold text-on-primary">Listo</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Paintbrush, Undo2 } from 'lucide-react-native';
import { BRUSH_NO_EDIT, brushLinesOf, brushTitle, createdOrRefusal, paintAt, percentLabel, sendWorkScope, sendWorkStage, sendWorkTag, stageCardsOf, undoStroke, WORK_TAG_COLORS, workMapView, workRowsOf, workStageRequest, workTagRequest, type Brush, type BrushStroke, type MapEditSend, type StageCard, type WorkMap, type WorkMapPoint, type WorkRow } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';
import { PanelSheet, SHEET_LABEL } from './CutChips';
import { NewLabel } from './ScopeForm';
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

function StageCardView(props: { card: StageCard; onBrush: () => void }) {
  const { card } = props;
  return (
    <View testID={`etapa-${card.id}`} className="rounded-2xl border-[1.5px] border-outline/15 bg-surface p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1"><Text className="text-[16px] font-bold text-on-surface">{card.name}</Text><Text className="mt-0.5 font-mono text-[13px] text-on-surface-variant">{card.line}</Text></View>
        <Text className="text-[24px] font-extrabold text-primary">{percentLabel(card.percent)}</Text>
      </View>
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-outline/15"><View className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, card.percent)}%` }} /></View>
      <View className="mt-3 flex-row items-center justify-between gap-2 border-t border-outline/10 pt-3">
        <Text className="flex-1 text-[13px] text-on-surface-variant">{card.days}</Text>
        <BrushButton testID={`etapa-brocha-${card.id}`} label="Tocar calles" onPress={props.onBrush} />
      </View>
      {card.streets.length ? <View className="mt-2 flex-row flex-wrap gap-1.5">{card.streets.map((street) => <Text key={street.id} className="rounded-md border border-outline/20 px-2 py-0.5 text-[13px] text-on-surface">{street.name}</Text>)}</View> : null}
    </View>
  );
}

function WorkRowView(props: { row: WorkRow; onBrush: () => void }) {
  const { row } = props;
  return (
    <View testID={`trabajo-fila-${row.id}`} className="flex-row items-center gap-3 rounded-2xl border-[1.5px] border-outline/15 bg-surface px-3 py-2.5">
      <Text className="w-5 text-center font-mono text-[13px] font-bold text-on-surface-variant">{row.order}</Text>
      <View className="h-3 w-8 rounded-full" style={{ backgroundColor: row.color }} />
      <View className="flex-1"><Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">{row.name}</Text><Text className="font-mono text-[13px] text-on-surface-variant">{row.line}</Text></View>
      <BrushButton testID={`trabajo-brocha-${row.id}`} label="Pintar" onPress={props.onBrush} />
    </View>
  );
}

type SheetProps = { kind: LayersKind | null; map: WorkMap; send: MapEditSend; onBrush: (brush: Brush) => void; onClose: () => void };

/** «Etapas» (o-04) and «Trabajos» (o-05) on the phone: the cards, and the brush that opens the map. */
export function WorkLayersSheet(props: SheetProps) {
  const stages = props.kind === 'stages';
  const { cards, loose } = stageCardsOf(props.map);
  return (
    <PanelSheet open={props.kind !== null} onClose={props.onClose} testID={stages ? 'mapa-etapas' : 'mapa-trabajos'}>
      <View>
        <Text className="text-[12px] font-bold uppercase tracking-[1.5px] text-primary">{stages ? 'Partir la obra' : 'Qué se hace en cada calle'}</Text>
        <Text className="text-[22px] font-bold text-on-surface">{stages ? 'Etapas' : 'Trabajos'}</Text>
      </View>
      {stages ? cards.map((card) => <StageCardView key={card.id} card={card} onBrush={() => props.onBrush({ kind: 'stage', id: card.id })} />) : workRowsOf(props.map).map((row) => <WorkRowView key={row.id} row={row} onBrush={() => props.onBrush({ kind: 'work', id: row.id })} />)}
      {stages
        ? <NewLabel testID="etapa" placeholder="Nueva etapa" onCreate={(name) => createdOrRefusal(props.send(workStageRequest(name), sendWorkStage))} />
        : <NewLabel testID="trabajo" placeholder="Agregar trabajo" colors={WORK_TAG_COLORS} onCreate={(name, color) => createdOrRefusal(props.send(workTagRequest(name, color), sendWorkTag))} />}
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

/** The brush's taps, kept so «Deshacer» walks them back one by one. */
function useStrokes(map: WorkMap, send: MapEditSend, brush: Brush) {
  const [state, setState] = useState<{ error: string | null; busy: boolean; strokes: BrushStroke[] }>({ error: null, busy: false, strokes: [] });
  const latest = useRef(map);
  latest.current = map;
  const scope = (request: Parameters<MapEditSend>[0]) => send(request, sendWorkScope);
  const run = async (work: () => Promise<{ failure: string | null; next: (strokes: BrushStroke[]) => BrushStroke[] }>) => {
    if (state.busy) return;
    setState((before) => ({ ...before, busy: true }));
    const { failure, next } = await work();
    setState((before) => ({ error: failure, busy: false, strokes: failure ? before.strokes : next(before.strokes) }));
  };
  const tap = (place: WorkMapPoint) => run(async () => {
    const { failure, stroke } = await paintAt(latest.current, brush, place, scope);
    return { failure, next: (strokes) => (stroke ? [...strokes, stroke] : strokes) };
  });
  const last = state.strokes[state.strokes.length - 1];
  const undo = () => run(async () => ({ failure: last ? await undoStroke(last, latest.current, scope) : BRUSH_NO_EDIT, next: (strokes) => strokes.slice(0, -1) }));
  return { ...state, tap, undo, canUndo: Boolean(last) };
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
        <WorkMapSurface view={view} moves stretches={brushLinesOf(props.map, props.brush)} onTap={(place) => void strokes.tap(place)} />
        <View testID="mapa-brocha" className="absolute inset-x-3 rounded-2xl border border-primary/30 bg-surface p-3" style={{ top: margins.cabecera + BAND_GAP }}>
          <Text className="text-[15px] font-semibold text-on-surface">{strokes.busy ? 'Guardando…' : brushTitle(props.map, props.brush)}</Text>
          {strokes.error ? <Text testID="brocha-error" className="mt-1 text-[13px] font-semibold text-error">{strokes.error}</Text> : null}
          <View className="mt-2 flex-row gap-2">
            <Pressable testID="brocha-deshacer" disabled={!strokes.canUndo || strokes.busy} onPress={() => void strokes.undo()} className={`h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-primary/30 ${strokes.canUndo ? '' : 'opacity-40'}`}>
              <Undo2 size={16} color={colors.primary} /><Text className="text-[15px] font-semibold text-primary">Deshacer</Text>
            </Pressable>
            <Pressable testID="brocha-listo" onPress={props.onDone} className="h-11 flex-1 items-center justify-center rounded-xl bg-primary"><Text className="text-[15px] font-semibold text-on-primary">Listo</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react-native';
import { LAYER_LEGEND, layerBarOf, layerStreetsToggle, type LayerLatest, type LayerStreetSummary, type LayerSummary } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

/** What is done, solid from the left (design ma01; José 28/11: nothing waits for approval). */
function LayerBar(props: { row: Pick<LayerStreetSummary, 'donePct' | 'pendingPct'>; color: string; tall?: boolean }) {
  const bar = layerBarOf(props.row);
  return (
    <View className={`overflow-hidden rounded-full bg-surface-variant ${props.tall ? 'h-3' : 'h-2'}`}>
      <View className="absolute inset-y-0 left-0" style={{ width: bar.done, backgroundColor: props.color }} />
    </View>
  );
}

function StreetRow(props: { row: LayerStreetSummary; color: string }) {
  const { row } = props;
  return (
    <View testID={`capa-calle-${row.streetId}`} className="gap-2 rounded-2xl bg-surface-variant/60 px-4 py-3">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
        <Text className="text-[16px] font-semibold text-on-surface">{row.name}</Text>
        <Text className="font-mono text-[14px] text-on-surface-variant">{row.amount}  <Text className="font-bold text-on-surface">{row.percentText}</Text></Text>
      </View>
      <LayerBar row={row} color={props.color} />
    </View>
  );
}

function Latest(props: { latest: LayerLatest }) {
  return (
    <View testID="capa-ultimo">
      <Text className="text-[14px] text-on-surface-variant">{props.latest.text}</Text>
    </View>
  );
}

/** «Hecho» in the layer's colour, «Pendiente de ejecución» in the map's orange, no dashes (José 28/11). */
function Legend(props: { color: string }) {
  return (
    <View testID="capa-leyenda" className="flex-row items-center gap-2">
      <View className="h-1.5 w-5 rounded-full border border-on-surface/40" style={{ backgroundColor: props.color }} />
      <Text className="text-[13px] text-on-surface-variant">{`${LAYER_LEGEND.done}  ·`}</Text>
      <View className="h-1.5 w-5 rounded-full border border-on-surface/40" style={{ backgroundColor: LAYER_LEGEND.plannedColor }} />
      <Text className="text-[13px] text-on-surface-variant">{LAYER_LEGEND.planned}</Text>
    </View>
  );
}

type SheetProps = { summary: LayerSummary; latest: LayerLatest | null; badge?: ReactNode; onRecord?: () => void; /** The phone's peek (José 28/11): figure, bar and the action; the streets on demand. */ expanded?: boolean; onExpand?: () => void };

/** «Ver 4 calles» / «Ocultar calles»: the peek grows to the rows. */
function StreetsToggle(props: { count: number; expanded: boolean; onPress: () => void }) {
  const colors = useColores();
  const Icon = props.expanded ? ChevronUp : ChevronDown;
  return (
    <Pressable testID="capa-ver-calles" accessibilityRole="button" accessibilityState={{ expanded: props.expanded }} onPress={props.onPress} className="h-10 flex-row items-center gap-1 self-start">
      <Text className="text-[14px] font-semibold text-primary">{layerStreetsToggle(props.count, props.expanded)}</Text>
      <Icon size={16} color={colors.primary} />
    </Pressable>
  );
}

/**
 * The sheet of the active layer (design ma01, José 28/11): its figure, one row per street with its
 * bar, the legend, the latest progress and ONE «Registrar avance de <capa>». On a phone it opens as
 * a peek and grows to the streets.
 */
export function LayerSheet(props: SheetProps) {
  const { summary } = props;
  const expanded = props.expanded ?? true;
  return (
    <View testID="mapa-capa-hoja" className={expanded ? 'gap-3' : 'gap-2'}>
      <View className="flex-row items-center justify-between gap-2">
        <Text numberOfLines={1} className="min-w-0 flex-1 text-[12px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{summary.kicker}</Text>
        {expanded ? props.badge : null}
      </View>
      <View testID="mapa-avance" className="gap-2">
        <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
          <Text className={`${expanded ? 'text-[22px]' : 'text-[18px]'} font-extrabold text-on-surface`}>{summary.headline}</Text>
          {summary.streets.length ? <Text className={`${expanded ? 'text-[30px]' : 'text-[22px]'} font-extrabold text-on-surface`}>{summary.percentText}</Text> : null}
        </View>
        <LayerBar row={summary} color={summary.color} tall={expanded} />
        {expanded && summary.widthNote ? <Text testID="capa-sin-ancho" className="text-[12px] text-on-surface-variant">{summary.widthNote}</Text> : null}
      </View>
      {expanded && props.onExpand && summary.streets.length ? <StreetsToggle count={summary.streets.length} expanded onPress={props.onExpand} /> : null}
      {expanded && summary.streets.length ? <View className="gap-2">{summary.streets.map((row) => <StreetRow key={row.streetId} row={row} color={summary.color} />)}</View> : null}
      {expanded ? <Legend color={summary.color} /> : null}
      {expanded && props.latest ? <Latest latest={props.latest} /> : null}
      {props.onRecord ? <RecordLayerButton label={summary.recordLabel} onPress={props.onRecord} /> : null}
    </View>
  );
}

/** «Registrar avance de <capa>»: the sheet's ONE action (52 dp, primary); alone when the sheet is folded. */
export function RecordLayerButton(props: { label: string; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID="capa-registrar" accessibilityRole="button" onPress={props.onPress} className="h-[52px] flex-row items-center justify-center gap-3 rounded-2xl bg-primary px-5">
      <Pencil size={20} color={colors['on-primary']} />
      <Text numberOfLines={1} className="flex-shrink text-[16px] font-bold text-on-primary">{props.label}</Text>
    </Pressable>
  );
}

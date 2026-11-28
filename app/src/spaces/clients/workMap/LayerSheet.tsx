import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react-native';
import { LAYER_LEGEND, layerBarOf, layerStreetsToggle, type LayerLatest, type LayerStreetSummary, type LayerSummary } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

/** Stripes of what waits for approval: enough to fill the widest bar. */
const HATCH_STRIPES = 60;
const HATCH_STEP = { width: 3, marginRight: 4, opacity: 0.55, transform: [{ skewX: '-35deg' }] } as const;
const HATCH_FILL_OPACITY = 0.18;

/** Approved solid from the left, what waits hatched right after it (design ma01). */
function LayerBar(props: { row: Pick<LayerStreetSummary, 'donePct' | 'pendingPct'>; color: string; tall?: boolean }) {
  const bar = layerBarOf(props.row);
  return (
    <View className={`overflow-hidden rounded-full bg-surface-variant ${props.tall ? 'h-3' : 'h-2'}`}>
      <View className="absolute inset-y-0 left-0" style={{ width: bar.done, backgroundColor: props.color }} />
      {props.row.pendingPct > 0 ? (
        <View testID="capa-por-aprobar" className="absolute inset-y-0 flex-row overflow-hidden" style={{ left: bar.pendingLeft, width: bar.pending }}>
          <View className="absolute inset-0" style={{ backgroundColor: props.color, opacity: HATCH_FILL_OPACITY }} />
          {Array.from({ length: HATCH_STRIPES }, (_unused, index) => <View key={index} style={{ ...HATCH_STEP, backgroundColor: props.color }} />)}
        </View>
      ) : null}
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
    <View testID="capa-ultimo" className="flex-row flex-wrap items-center gap-2">
      <Text className="text-[14px] text-on-surface-variant">{props.latest.text}</Text>
      {props.latest.pill ? <Text className="rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[12px] font-bold uppercase text-warning">{props.latest.pill}</Text> : null}
    </View>
  );
}

/** «— Hecho · - - Planificado» in the layer's colour (design ma01). */
function Legend(props: { color: string }) {
  return (
    <View testID="capa-leyenda" className="flex-row items-center gap-2">
      <View className="h-1 w-5 rounded-full" style={{ backgroundColor: props.color }} />
      <Text className="text-[13px] text-on-surface-variant">{`${LAYER_LEGEND.done}  ·`}</Text>
      <View className="w-5 border-t-[3px] border-dashed" style={{ borderColor: props.color }} />
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
  const colors = useColores();
  const expanded = props.expanded ?? true;
  return (
    <View testID="mapa-capa-hoja" className="gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="min-w-0 flex-1 text-[13px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{summary.kicker}</Text>
        {props.badge}
      </View>
      <View testID="mapa-avance" className="gap-3">
        <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
          <Text className="text-[22px] font-extrabold text-on-surface">{summary.headline}</Text>
          {summary.streets.length ? <Text className="text-[30px] font-extrabold text-on-surface">{summary.percentText}</Text> : null}
        </View>
        <LayerBar row={summary} color={summary.color} tall />
        {summary.widthNote ? <Text testID="capa-sin-ancho" className="text-[12px] text-on-surface-variant">{summary.widthNote}</Text> : null}
      </View>
      {props.onExpand && summary.streets.length ? <StreetsToggle count={summary.streets.length} expanded={expanded} onPress={props.onExpand} /> : null}
      {expanded && summary.streets.length ? <View className="gap-2">{summary.streets.map((row) => <StreetRow key={row.streetId} row={row} color={summary.color} />)}</View> : null}
      {expanded ? <Legend color={summary.color} /> : null}
      {expanded && props.latest ? <Latest latest={props.latest} /> : null}
      {props.onRecord ? (
        <Pressable testID="capa-registrar" accessibilityRole="button" onPress={props.onRecord} className="h-[52px] flex-row items-center justify-center gap-3 rounded-2xl bg-primary px-5">
          <Pencil size={20} color={colors['on-primary']} />
          <Text numberOfLines={1} className="flex-shrink text-[16px] font-bold text-on-primary">{summary.recordLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

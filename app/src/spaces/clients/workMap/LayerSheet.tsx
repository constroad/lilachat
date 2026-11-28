import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Clock, Pencil } from 'lucide-react-native';
import { layerBarOf, type LayerLatest, type LayerStreetSummary, type LayerSummary } from '@lilachat/shared';
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
  const colors = useColores();
  return (
    <View testID="capa-ultimo" className="flex-row flex-wrap items-center gap-2">
      <Clock size={16} color={colors['on-surface-variant']} />
      <Text className="text-[14px] text-on-surface-variant">{props.latest.text}</Text>
      {props.latest.pill ? <Text className="rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[12px] font-bold uppercase text-warning">{props.latest.pill}</Text> : null}
    </View>
  );
}

/**
 * The sheet of the active layer (design ma01, José 28/11): its big figure, one row per street with
 * its bar, the latest progress and «Registrar avance de <capa>». It replaces the panel's old head.
 */
export function LayerSheet(props: { summary: LayerSummary; latest: LayerLatest | null; badge?: ReactNode; onRecord?: () => void }) {
  const { summary } = props;
  const colors = useColores();
  return (
    <View testID="mapa-capa-hoja" className="gap-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="min-w-0 flex-1 text-[13px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{summary.kicker}</Text>
        {props.badge}
      </View>
      <View testID="mapa-avance" className="gap-3">
        <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
          <Text className="text-[26px] font-extrabold text-on-surface">{summary.headline}</Text>
          {summary.streets.length ? <Text className="text-[34px] font-extrabold text-on-surface">{summary.percentText}</Text> : null}
        </View>
        <LayerBar row={summary} color={summary.color} tall />
        {summary.widthNote ? <Text testID="capa-sin-ancho" className="text-[12px] text-on-surface-variant">{summary.widthNote}</Text> : null}
      </View>
      {summary.streets.length ? <View className="gap-2">{summary.streets.map((row) => <StreetRow key={row.streetId} row={row} color={summary.color} />)}</View> : null}
      {props.latest ? <Latest latest={props.latest} /> : null}
      {props.onRecord ? (
        <Pressable testID="capa-registrar" accessibilityRole="button" onPress={props.onRecord} className="min-h-[56px] flex-row items-center justify-center gap-3 rounded-2xl bg-on-surface px-5">
          <Pencil size={20} color={colors.background} />
          <Text className="flex-shrink text-[17px] font-bold text-background">{summary.recordLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

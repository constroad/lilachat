import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, Text, View, useWindowDimensions, type TextStyle } from 'react-native';
import {
  PERIOD_LABEL,
  panelAmountOf,
  panelBarsOf,
  panelCountsOf,
  panelOf,
  panelRangeOf,
  panelTablesOf,
  periodStartOf,
  responseTimesOf,
  type BoardPeriod,
  type PanelBar,
  type PanelCount,
  type PanelTable,
} from '@lilachat/shared';
import { Segmentado } from '../../ui/Segmentado';
import { useDisposicion } from '../../ui/useDisposicion';
import { EmptyNote, Pill, SkeletonRows } from './daliParts';
import type { ProspectList } from './prospectsApi';

type Panel = ReturnType<typeof panelOf>;
const PERIODS: readonly BoardPeriod[] = ['today', 'week', 'month'];
const PERIOD_OPTIONS = PERIODS.map((key) => ({ key, etiqueta: PERIOD_LABEL[key], testID: `periodo-panel-${key}` }));
const KICKER = 'text-[11px] font-bold uppercase tracking-widest text-on-surface-variant';
const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };
const CONTENT = { padding: 16, paddingBottom: 32, gap: 16 };
/** A table's header shrinks a little before it is cut («SOLO CONSULTA» in a wide column). */
const HEAD_MIN_SCALE = 0.8;
/** NativeWind only sees literal classes: the width of a number column on a phone and where there is room. */
const NUMBER_CELL = { narrow: 'w-[68px] text-right', wide: 'w-[84px] text-right' } as const;
/** Every column fits from this window width (a rotated phone); below it, and in a tablet's list column, a phone's. */
const ALL_COLUMNS_MIN_WIDTH = 720;

/**
 * The sales panel (dl-04 v5 on a phone): the prospects BORN in the period, followed to wherever they got. What has no
 * source does not go: Meta's costs (no `ads_read`), automatic assignment, «Exportar» and the lines Stitch wrote under
 * each figure. The amount won is an admin's: nobody else receives amounts. A phone, or the list column of a tablet,
 * keeps the table columns that fit; a rotated phone shows them all.
 */
export function DaliPanel({ list, now }: { list: ProspectList | null; now: Date }) {
  const [period, setPeriod] = useState<BoardPeriod>('week');
  const { dosPaneles } = useDisposicion();
  const { width } = useWindowDimensions();
  const panel = useMemo(() => panelOf(list?.prospects ?? [], { from: periodStartOf(period, now) }), [list, period, now]);
  if (!list) return <View className="p-4"><SkeletonRows /></View>;
  return (
    <ScrollView testID="panel-dali" keyboardShouldPersistTaps="handled" contentContainerStyle={CONTENT}>
      <View className="gap-3">
        <Text accessibilityRole="header" className="text-[22px] font-extrabold tracking-tight text-on-surface">Panel de ventas</Text>
        <View testID="periodo-panel">
          <Segmentado opciones={PERIOD_OPTIONS} valor={period} onCambiar={setPeriod} />
        </View>
        <Text testID="panel-rango" className="self-end text-[13px] text-on-surface-variant">{panelRangeOf(period, now)}</Text>
      </View>
      {panel.totals.prospects === 0 ? <EmptyNote title="No llegó ningún prospecto en este periodo." /> : <PanelBody panel={panel} admin={list.admin} narrow={dosPaneles || width < ALL_COLUMNS_MIN_WIDTH} />}
    </ScrollView>
  );
}

function PanelBody({ panel, admin, narrow }: { panel: Panel; admin: boolean; narrow: boolean }) {
  const tables = panelTablesOf(panel, narrow);
  const bars = panelBarsOf(panel);
  const amount = panelAmountOf(panel.totals, admin);
  const cell = narrow ? NUMBER_CELL.narrow : NUMBER_CELL.wide;
  return (
    <>
      <View className="flex-row flex-wrap gap-3">
        {panelCountsOf(panel.totals).map((count) => <CountCard key={count.key} count={count} />)}
      </View>
      {amount === null ? null : <AmountCard amount={amount} />}
      <ResponseCard times={responseTimesOf(panel.firstResponse)} />
      <Block title="Por origen"><Table table={tables.origin} cell={cell} /></Block>
      <Block title="Embudo"><Bars bars={bars.funnel} /></Block>
      {tables.ad.rows.length ? <Block title="Por anuncio"><Table table={tables.ad} cell={cell} /></Block> : null}
      <Block title="Intención"><Bars bars={bars.intents} /></Block>
      {tables.sellers.rows.length ? <Block title="Vendedores"><Table table={tables.sellers} cell={cell} /></Block> : null}
      {bars.lossReasons.length ? <Block title="Por qué se pierden"><Bars bars={bars.lossReasons} fill="bg-error/70" /></Block> : null}
    </>
  );
}

/** «CALIFICADOS 41» with its share of the prospects beside the label (dl-04 v5); the won in green. */
function CountCard({ count }: { count: PanelCount }) {
  const won = count.tone === 'ok';
  return (
    <View testID={`panel-${count.key}`} className="min-w-[45%] flex-1 rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <View className="min-h-[24px] flex-row items-center justify-between gap-2">
        <Text numberOfLines={1} className={`shrink ${KICKER}`}>{count.label}</Text>
        {count.percent ? <Pill tone={won ? 'ok' : 'neutral'}>{count.percent}</Pill> : null}
      </View>
      <Text style={TABULAR} className={`mt-1 text-[30px] font-extrabold ${won ? 'text-en-linea' : 'text-on-surface'}`}>{count.value}</Text>
    </View>
  );
}

/** Only for a space admin (dl-04 v5, without Stitch's «ÉXITO» and «6 contratos»). */
function AmountCard({ amount }: { amount: string }) {
  return (
    <View testID="panel-monto" className="overflow-hidden rounded-xl border border-outline/15 bg-surface">
      <View className="h-1 bg-primary" />
      <View className="px-4 py-3">
        <Text className={KICKER}>Monto ganado</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={TABULAR} className="mt-1 text-[28px] font-extrabold text-primary">{amount}</Text>
      </View>
    </View>
  );
}

/** The median first answer of Dali and of a person of the team (not an average: Stitch's «(promedio)» does not go). */
function ResponseCard({ times }: { times: { dali: string; team: string } }) {
  return (
    <View testID="panel-primera-respuesta" className="rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <Text className={KICKER}>Primera respuesta</Text>
      <View className="mt-2 flex-row items-center">
        <ResponseHalf label="Dali" value={times.dali} accent />
        <View className="mx-3 h-6 w-px bg-outline/20" />
        <ResponseHalf label="Equipo" value={times.team} />
      </View>
    </View>
  );
}

function ResponseHalf({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="min-w-0 flex-1 flex-row items-center gap-2">
      <View className={`h-2 w-2 rounded-full ${accent ? 'bg-primary' : 'bg-on-surface-variant'}`} />
      <Text className="text-[14px] text-on-surface-variant">{`${label}:`}</Text>
      <Text numberOfLines={1} style={TABULAR} className={`shrink text-[17px] font-bold ${accent ? 'text-primary' : 'text-on-surface'}`}>{value}</Text>
    </View>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <Text className={KICKER}>{title}</Text>
      <View className="mt-2">{children}</View>
    </View>
  );
}

function Table({ table, cell }: { table: PanelTable; cell: string }) {
  return (
    <View>
      <View className="flex-row border-b border-outline/10 pb-1.5">
        {table.head.map((head, index) => (
          <Text key={head} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={HEAD_MIN_SCALE} className={`text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant ${index ? cell : 'min-w-0 flex-1'}`}>
            {head}
          </Text>
        ))}
      </View>
      {table.rows.map((row, index) => (
        <View key={row.key} className={`min-h-[36px] flex-row items-center py-1.5 ${index ? 'border-t border-outline/10' : ''}`}>
          {row.cells.map((value, column) =>
            column ? (
              <Text key={column} numberOfLines={1} style={TABULAR} className={`text-[13px] text-on-surface ${cell}`}>{value}</Text>
            ) : (
              <Text key={column} numberOfLines={1} className="min-w-0 flex-1 text-[13px] font-semibold text-on-surface">{value}</Text>
            )
          )}
        </View>
      ))}
    </View>
  );
}

function Bars({ bars, fill = 'bg-primary' }: { bars: PanelBar[]; fill?: 'bg-primary' | 'bg-error/70' }) {
  return (
    <View className="gap-2.5">
      {bars.map((bar) => (
        <View key={bar.key}>
          <View className="flex-row justify-between gap-3">
            <Text numberOfLines={1} className="shrink text-[13px] text-on-surface">{bar.label}</Text>
            <Text style={TABULAR} className="text-[13px] font-semibold text-on-surface">{bar.value}</Text>
          </View>
          <View className="mt-1 h-2 overflow-hidden rounded-full bg-surface-variant/60">
            <View className={`h-full rounded-full ${fill}`} style={{ width: `${bar.share}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}

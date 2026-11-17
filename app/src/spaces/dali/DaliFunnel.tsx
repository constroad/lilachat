import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View, type DimensionValue, type ListRenderItemInfo } from 'react-native';
import { CircleAlert } from 'lucide-react-native';
import { firstBusyStageOf, funnelCardOf, funnelFiguresOf, funnelIsEmpty, funnelOf, funnelSubtitleOf, inboxOf, periodStartOf, prospectNameOf, type FunnelFigure, type FunnelPeriod, type ProspectStage, type ProspectView } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { MONO_FONT } from '../../ui/monoFont';
import { Rotulo } from '../../ui/Rotulo';
import { Segmentado, type OpcionSegmentada } from '../../ui/Segmentado';
import { useColores } from '../../ui/tema';
import { useDisposicion } from '../../ui/useDisposicion';
import { EmptyNote, OriginPill, Pill, ScorePill, SkeletonRows } from './daliParts';
import { ServiceFilter } from './DaliInbox';
import { ProspectAvatar } from './ProspectRow';
import type { ProspectList } from './prospectsApi';

type Props = { list: ProspectList | null; now: Date; service?: string; onService: (key: string | undefined) => void; onOpenProspect: (prospect: ProspectView) => void };
type Funnel = ReturnType<typeof funnelOf>;
type Column = Funnel['columns'][number];
/** Figures and stage tiles per row: two on a phone or a tablet's list pane, four when turned or centered wide. */
type PerRow = 2 | 4;

const SIDE_ROOM = 16;
const LIST_BOTTOM_ROOM = 24;
const CARD_AVATAR = 32;
const FOOT_AVATAR = 22;
const ALERT_ICON = 13;
/** Screens of cards kept mounted around the visible one (a stage can hold the whole month). */
const LIST_WINDOW = 7;
const MONO = { fontFamily: MONO_FONT };
const CELL_WIDTH: Record<PerRow, DimensionValue> = { 2: '50%', 4: '25%' };
const PERIODS: readonly OpcionSegmentada<FunnelPeriod>[] = [
  { key: 'week', etiqueta: 'Últimos 7 días', testID: 'periodo-embudo-week' },
  { key: 'month', etiqueta: 'Este mes', testID: 'periodo-embudo-month' },
];
const FIGURE_TEST_ID: Record<FunnelFigure['key'], string> = { missing_info: 'cifra-falta', to_quote: 'cifra-por-cotizar', quote_unanswered: 'cifra-sin-respuesta', without_next_action: 'cifra-sin-proxima' };
/** NativeWind only sees literal classes: the stages the funnel colors (dl-08), the rest in the surface's ink. */
const STAGE_INK: Record<ProspectStage, string> = { missing_info: 'text-on-surface', to_quote: 'text-warning', visit: 'text-on-surface', quoted: 'text-on-surface', negotiation: 'text-on-surface', won: 'text-en-linea', lost: 'text-error' };
const NOTE_BOX = { warn: 'border-warning/30 bg-warning/10', error: 'border-error/30 bg-error/5', dashed: 'border-dashed border-error/40' } as const;
const NOTE_INK = { warn: 'text-warning', error: 'text-error', dashed: 'text-error' } as const;
const prospectKey = (prospect: ProspectView): string => prospect.id;

/**
 * The funnel (dl-08, v5 on a phone): where each prospect goes, with the four figures that need someone (missing
 * information, to quote, quotes without an answer, no next action) and the board by stage as 2×N tiles, the chosen
 * stage's prospects under it. Filtered by service (José 16/11). The hours of the next actions come from each prospect;
 * Stitch's «MÉTRICAS DEL EMBUDO», the tiles' percentages, «ACTIVO», «CERRADO», «ORDENAR» and «Ver chat» do not go.
 */
export function DaliFunnel(props: Props) {
  const { list, now, onOpenProspect } = props;
  const { amplia, dosPaneles } = useDisposicion();
  const perRow: PerRow = amplia && !dosPaneles ? 4 : 2;
  const [period, setPeriod] = useState<FunnelPeriod>('week');
  const [chosen, setChosen] = useState<ProspectStage | null>(null);
  const prospects = useMemo(() => list?.prospects ?? [], [list]);
  const funnel = useMemo(() => funnelOf(prospects, { since: periodStartOf(period, now), service: props.service }, now), [prospects, period, props.service, now]);
  const services = useMemo(() => inboxOf(prospects, { me: '', view: 'all' }, now).services, [prospects, now]);
  const admin = list?.admin ?? false;
  const renderCard = useCallback(({ item: prospect }: ListRenderItemInfo<ProspectView>) => <FunnelCard prospect={prospect} now={now} admin={admin} onOpen={onOpenProspect} />, [now, admin, onOpenProspect]);
  if (!list) {
    return (
      <View className="p-4">
        <SkeletonRows />
      </View>
    );
  }
  const empty = funnelIsEmpty(funnel);
  const stage = chosen ?? firstBusyStageOf(funnel.columns);
  const column = empty ? undefined : funnel.columns.find((one) => one.stage === stage);
  const header = <FunnelHeader funnel={funnel} period={period} onPeriod={setPeriod} services={services} service={props.service} onService={props.onService} now={now} perRow={perRow} empty={empty} stage={stage} onStage={setChosen} column={column} />;
  return (
    <FlatList
      testID="embudo-dali"
      data={column?.items ?? []}
      keyExtractor={prospectKey}
      renderItem={renderCard}
      windowSize={LIST_WINDOW}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingHorizontal: SIDE_ROOM, paddingBottom: LIST_BOTTOM_ROOM }}
      keyboardShouldPersistTaps="handled"
    />
  );
}

type HeaderProps = {
  funnel: Funnel;
  period: FunnelPeriod;
  onPeriod: (period: FunnelPeriod) => void;
  services: readonly { key: string; name: string; count: number }[];
  service?: string;
  onService: (key: string | undefined) => void;
  now: Date;
  perRow: PerRow;
  empty: boolean;
  stage: ProspectStage;
  onStage: (stage: ProspectStage) => void;
  column: Column | undefined;
};

/** Over the cards: the title and its line, the period, the service, the four figures, the tiles and the chosen stage. */
function FunnelHeader(props: HeaderProps) {
  const { funnel } = props;
  return (
    <View className="pt-4">
      <View className="gap-4">
        <View>
          <Text accessibilityRole="header" className="text-xl font-extrabold text-on-surface">En qué va cada prospecto</Text>
          <Text className="mt-0.5 text-[13px] text-on-surface-variant">{funnelSubtitleOf(funnel, props.period)}</Text>
        </View>
        <Segmentado opciones={PERIODS} valor={props.period} onCambiar={props.onPeriod} />
        <ServiceFilter testID="filtro-servicio-embudo" services={props.services} value={props.service} onChange={props.onService} />
        <Figures figures={funnelFiguresOf(funnel.figures, props.now)} perRow={props.perRow} />
        {props.empty ? <EmptyNote title="Todavía no hay prospectos en este periodo." /> : <StageTiles columns={funnel.columns} stage={props.stage} perRow={props.perRow} onPick={props.onStage} />}
      </View>
      {props.column ? <Rotulo>{`${props.column.label} · ${props.column.items.length}`}</Rotulo> : null}
    </View>
  );
}

function Figures({ figures, perRow }: { figures: FunnelFigure[]; perRow: PerRow }) {
  return (
    <View className="flex-row flex-wrap overflow-hidden rounded-xl border border-outline/15 bg-surface">
      {figures.map((figure, index) => (
        <FigureCell key={figure.key} figure={figure} width={CELL_WIDTH[perRow]} lastInRow={(index + 1) % perRow === 0} lastRow={index >= figures.length - perRow} />
      ))}
    </View>
  );
}

/** A figure: how many, what, and who is late (in red) or a hint. «Sin próxima acción» turns red while it has anyone. */
function FigureCell({ figure, width, lastInRow, lastRow }: { figure: FunnelFigure; width: DimensionValue; lastInRow: boolean; lastRow: boolean }) {
  const colors = useColores();
  const ink = figure.danger ? 'text-error' : 'text-on-surface';
  return (
    <View testID={FIGURE_TEST_ID[figure.key]} style={{ width }} className={`border-outline/15 px-4 py-3 ${lastInRow ? '' : 'border-r'} ${lastRow ? '' : 'border-b'} ${figure.danger ? 'bg-error/5' : ''}`}>
      <Text className={`text-3xl font-extrabold ${ink}`}>{String(figure.value)}</Text>
      <Text className={`text-sm font-bold ${ink}`}>{figure.title}</Text>
      {figure.alert ? (
        <View className="mt-0.5 flex-row items-start gap-1">
          <CircleAlert size={ALERT_ICON} color={colors.error} />
          <Text className="min-w-0 flex-1 text-[12px] font-medium text-error">{figure.alert}</Text>
        </View>
      ) : figure.hint ? (
        <Text numberOfLines={2} className="mt-0.5 text-[12px] text-on-surface-variant">{figure.hint}</Text>
      ) : null}
    </View>
  );
}

/** The board on a phone (dl-08 v5): a tile per stage with how many it holds; the chosen one's prospects go under it. */
function StageTiles({ columns, stage, perRow, onPick }: { columns: Column[]; stage: ProspectStage; perRow: PerRow; onPick: (stage: ProspectStage) => void }) {
  return (
    <View className="-m-1 flex-row flex-wrap">
      {columns.map((column) => {
        const picked = column.stage === stage;
        return (
          <View key={column.stage} style={{ width: CELL_WIDTH[perRow] }} className="p-1">
            <Pressable
              testID={`baldosa-${column.stage}`}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              onPress={() => onPick(column.stage)}
              className={`min-h-[64px] justify-center rounded-xl border px-3 py-2 ${picked ? 'border-primary bg-primary/5' : 'border-outline/15 bg-surface'}`}
            >
              <Text className="text-2xl font-extrabold text-on-surface">{String(column.items.length)}</Text>
              <Text numberOfLines={1} className={`text-[13px] font-semibold ${STAGE_INK[column.stage]}`}>{column.label}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/** A prospect in its stage: what is missing, what is late, the quote (its amount only for admins), the call for a next action and who follows it. */
const FunnelCard = memo(function FunnelCard({ prospect, now, admin, onOpen }: { prospect: ProspectView; now: Date; admin: boolean; onOpen: (prospect: ProspectView) => void }) {
  const colors = useColores();
  const card = funnelCardOf(prospect, now, admin);
  return (
    <Pressable
      testID={`tarjeta-${prospect.id}`}
      accessibilityRole="button"
      onPress={() => onOpen(prospect)}
      android_ripple={{ color: colors.outline }}
      className={`mb-2.5 gap-2 overflow-hidden rounded-xl border bg-surface px-3 py-3 ${card.overdue ? 'border-error/30' : 'border-outline/15'}`}
    >
      <FunnelCardHead prospect={prospect} />
      {prospect.score !== undefined || card.daliAlone ? (
        <View className="flex-row flex-wrap items-center gap-1.5">
          <ScorePill score={prospect.score} />
          {card.daliAlone ? <Pill tone="primary">Dali</Pill> : null}
        </View>
      ) : null}
      {card.missing ? <Note tone="warn">{card.missing}</Note> : null}
      {card.overdue ? <Note tone="error">{card.overdue}</Note> : null}
      {card.quote ? <QuoteLine code={card.quote.code} amount={card.quote.amount} /> : null}
      {card.needsNextAction ? <Note tone="dashed" testID="sin-proxima-accion">Sin próxima acción · Agendar</Note> : null}
      {card.foot ? <Foot assignee={card.foot.assignee} text={card.foot.text} /> : null}
    </Pressable>
  );
});

function FunnelCardHead({ prospect }: { prospect: ProspectView }) {
  const name = prospectNameOf(prospect);
  return (
    <View className="flex-row items-start gap-2.5">
      <ProspectAvatar name={name} size={CARD_AVATAR} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[14px] font-bold text-on-surface">{name}</Text>
        {prospect.service ? <Text numberOfLines={1} className="text-[12px] text-on-surface-variant">{prospect.service.name}</Text> : null}
      </View>
      <OriginPill prospect={prospect} />
    </View>
  );
}

function Note({ tone, children, testID }: { tone: keyof typeof NOTE_BOX; children: string; testID?: string }) {
  return (
    <View testID={testID} className={`rounded-lg border px-2.5 py-1.5 ${NOTE_BOX[tone]}`}>
      <Text className={`text-[12px] font-medium ${NOTE_INK[tone]}`}>{children}</Text>
    </View>
  );
}

function QuoteLine({ code, amount }: { code: string; amount: string | null }) {
  return (
    <View className="flex-row items-baseline justify-between gap-2">
      <Text numberOfLines={1} style={MONO} className="min-w-0 flex-1 text-[12px] text-on-surface">{code}</Text>
      {amount ? <Text style={MONO} className="shrink-0 text-[12px] font-semibold text-on-surface">{amount}</Text> : null}
    </View>
  );
}

/** «Próx: Hoy 16:00 · Llamar» with the seller's circle, or only who follows it. */
function Foot({ assignee, text }: { assignee: string | null; text: string }) {
  return (
    <View className="flex-row items-center gap-2 border-t border-outline/10 pt-2">
      {assignee ? <Avatar nombre={assignee} tamano={FOOT_AVATAR} /> : null}
      <Text numberOfLines={1} className="min-w-0 flex-1 text-[12px] text-on-surface-variant">{text}</Text>
    </View>
  );
}

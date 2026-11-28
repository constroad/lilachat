import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Camera, TriangleAlert } from 'lucide-react-native';
import { FEED_EMPTY, FEED_RANGES, FEED_SUMMARY_KICKER, FEED_TITLE, feedCounts, feedInRange, feedSummaryOf, limaDayKey, progressFeedOf, type ByApproveList, type FeedCard, type FeedRange, type ProgressPhotoResult, type WorkMap } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { AddProgressPhoto } from './AddProgressPhoto';
import { UndoProgress } from './PendingProgress';

const KICKER = 'text-[12px] font-bold uppercase tracking-[1.5px] text-on-surface-variant';

/** «Hoy 2 · Semana 11 · Todo 38» (design ma05). */
function RangeTabs(props: { range: FeedRange; counts: Record<FeedRange, number>; onRange: (range: FeedRange) => void }) {
  return (
    <View className="flex-row gap-1 rounded-2xl border border-outline/15 bg-surface p-1">
      {FEED_RANGES.map((option) => {
        const on = option.id === props.range;
        return (
          <Pressable key={option.id} testID={`avances-rango-${option.id}`} accessibilityState={{ selected: on }} onPress={() => props.onRange(option.id)} className={`h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl ${on ? 'bg-on-surface' : ''}`}>
            <Text className={`text-[15px] font-semibold ${on ? 'text-background' : 'text-on-surface'}`}>{option.label}</Text>
            <Text className={`font-mono text-[13px] ${on ? 'text-warning' : 'text-on-surface-variant'}`}>{props.counts[option.id]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Summary(props: { cards: FeedCard[]; label: string }) {
  const summary = feedSummaryOf(props.cards);
  return (
    <View testID="avances-resumen" className="gap-1 rounded-2xl border-t-4 border-primary bg-surface p-4">
      <View className="flex-row justify-between"><Text className={KICKER}>{FEED_SUMMARY_KICKER}</Text><Text className="text-[12px] font-bold uppercase text-primary">{props.label} · {summary.count}</Text></View>
      <View className="flex-row items-baseline gap-4">
        <Text className="text-[34px] font-bold text-on-surface">{summary.meters}<Text className="text-[14px] font-semibold text-on-surface-variant"> m lineales</Text></Text>
        {summary.area ? <Text className="text-[34px] font-bold text-on-surface">{summary.area}<Text className="text-[14px] font-semibold text-on-surface-variant"> m² totales</Text></Text> : null}
      </View>
    </View>
  );
}

/** One progress: its work and street, chainages, metres, when and who; only an undone one has a pill. */
function FeedRow(props: { card: FeedCard; onUndo: (id: string) => Promise<string | null>; onAddPhoto?: AddPhoto }) {
  const colors = useColores();
  const { card } = props;
  const figures = [card.stretch, card.meters, card.area].filter(Boolean).join(' · ');
  return (
    <View testID={`avance-${card.id}`} className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3" style={card.color ? { borderLeftWidth: 4, borderLeftColor: card.color } : undefined}>
      <View className="flex-row gap-3">
        <View className="h-16 w-16 items-center justify-center rounded-xl bg-surface-variant"><Camera size={20} color={colors['on-surface-variant']} /></View>
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">{card.color ? <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: card.color }} /> : null}<Text numberOfLines={1} className="flex-1 text-[16px] font-bold text-on-surface">{card.title}</Text></View>
          {figures ? <Text numberOfLines={1} className="font-mono text-[14px] text-on-surface">{figures}</Text> : null}
          <Text className="text-[13px] text-on-surface-variant">{[card.when, card.author].filter(Boolean).join(' · ')}</Text>
        </View>
        {card.pill ? <Text testID={`avance-estado-${card.id}`} className="self-start rounded-md border border-error/40 bg-error/10 px-2 py-1 text-[11px] font-bold text-error">{card.pill}</Text> : null}
      </View>
      {card.rejectNote ? <View className="flex-row items-center gap-2 rounded-xl border border-error/30 bg-error/5 p-3"><TriangleAlert size={16} color={colors.error} /><Text className="flex-1 text-[14px] text-error">Nota: {card.rejectNote}</Text></View> : null}
      <AddProgressPhoto id={card.id} photos={card.photos} add={card.photoable && props.onAddPhoto ? () => props.onAddPhoto!(card.id) : undefined} />
      {card.undoable && card.toM !== null ? <UndoProgress id={card.id} toM={card.toM} onUndo={props.onUndo} /> : null}
    </View>
  );
}

/** «Agregar foto» on one record: the camera, the Drive upload, then Portal's tool; null when the camera was closed. */
type AddPhoto = (id: string) => Promise<ProgressPhotoResult | null>;
type FeedProps = { map: WorkMap; list: ByApproveList | null; /** An admin undoes any record; anyone else, their own. */ admin: boolean; onUndo: (id: string) => Promise<string | null>; onAddPhoto?: AddPhoto };

/** «Avances» (design ma05, José 28/11): every record, by Hoy / Semana / Todo; none waits for approval. */
export function ProgressFeed(props: FeedProps) {
  const [range, setRange] = useState<FeedRange>('hoy');
  const today = limaDayKey(new Date());
  const cards = useMemo(() => progressFeedOf(props.map, props.list, today, props.admin), [props.map, props.list, today, props.admin]);
  const shown = feedInRange(cards, range, today);
  return (
    <View testID="avances-lista" className="gap-3">
      <Text className={KICKER}>{FEED_TITLE}</Text>
      <RangeTabs range={range} counts={feedCounts(cards, today)} onRange={setRange} />
      <Summary cards={shown} label={FEED_RANGES.find((option) => option.id === range)?.label ?? ''} />
      {shown.map((card) => <FeedRow key={card.id} card={card} onUndo={props.onUndo} onAddPhoto={props.onAddPhoto} />)}
      {shown.length ? null : <Text className="text-[14px] text-on-surface-variant">{FEED_EMPTY}</Text>}
    </View>
  );
}

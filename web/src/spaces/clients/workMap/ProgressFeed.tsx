import { useMemo, useState } from 'react';
import { Camera, TriangleAlert } from 'lucide-react';
import { FEED_EMPTY, FEED_RANGES, FEED_SUMMARY_KICKER, FEED_TITLE, feedCounts, feedInRange, feedSummaryOf, limaDayKey, progressFeedOf, type ByApproveList, type FeedCard, type FeedRange, type WorkMap } from '@lilachat/shared';
import { UndoProgress } from './PendingProgress';

const KICKER = 'text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant';

/** «Hoy 2 · Semana 11 · Todo 38» (design ma05). */
function RangeTabs(props: { range: FeedRange; counts: Record<FeedRange, number>; onRange: (range: FeedRange) => void }) {
  return (
    <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl border border-outline/15 bg-surface p-1">
      {FEED_RANGES.map((option) => {
        const on = option.id === props.range;
        return (
          <button key={option.id} type="button" role="tab" aria-selected={on} data-testid={`avances-rango-${option.id}`} onClick={() => props.onRange(option.id)} className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold ${on ? 'bg-on-surface text-background' : 'text-on-surface hover:bg-background'}`}>
            {option.label}<span className={`font-mono text-[13px] ${on ? 'text-warning' : 'text-on-surface-variant'}`}>{props.counts[option.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

function Summary(props: { cards: FeedCard[]; label: string }) {
  const summary = feedSummaryOf(props.cards);
  return (
    <section data-testid="avances-resumen" className="rounded-2xl border border-outline/15 border-t-4 border-t-primary bg-surface p-4">
      <div className="flex justify-between"><p className={KICKER}>{FEED_SUMMARY_KICKER}</p><p className="text-[11px] font-bold uppercase text-primary">{props.label} · {summary.count}</p></div>
      <div className="mt-1 flex flex-wrap items-baseline gap-4">
        <p className="text-[34px] font-bold leading-tight text-on-surface">{summary.meters}<span className="text-[14px] font-semibold text-on-surface-variant"> m lineales</span></p>
        {summary.area ? <p className="text-[34px] font-bold leading-tight text-on-surface">{summary.area}<span className="text-[14px] font-semibold text-on-surface-variant"> m² totales</span></p> : null}
      </div>
    </section>
  );
}

/** One progress: its work and street, chainages, metres, when and who; only an undone one has a pill. */
function FeedRow(props: { card: FeedCard; onUndo: (id: string) => Promise<string | null> }) {
  const { card } = props;
  const figures = [card.stretch, card.meters, card.area].filter(Boolean).join(' · ');
  return (
    <li data-testid={`avance-${card.id}`} className="space-y-2 rounded-2xl border border-outline/15 bg-surface p-3" style={card.color ? { borderLeftWidth: 4, borderLeftColor: card.color } : undefined}>
      <div className="flex gap-3">
        <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-variant text-on-surface-variant"><Camera size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[16px] font-bold text-on-surface">{card.color ? <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: card.color }} /> : null}<span className="truncate">{card.title}</span></p>
          {figures ? <p className="truncate font-mono text-[14px] text-on-surface">{figures}</p> : null}
          <p className="text-[13px] text-on-surface-variant">{[card.when, card.author].filter(Boolean).join(' · ')}</p>
        </div>
        {card.pill ? <span data-testid={`avance-estado-${card.id}`} className="self-start rounded-md border border-error/40 bg-error/10 px-2 py-1 text-[11px] font-bold text-error">{card.pill}</span> : null}
      </div>
      {card.rejectNote ? <p className="flex items-center gap-2 rounded-xl border border-error/30 bg-error/5 p-3 text-[14px] text-error"><TriangleAlert size={16} className="shrink-0" />Nota: {card.rejectNote}</p> : null}
      {card.undoable && card.toM !== null ? <UndoProgress id={card.id} toM={card.toM} onUndo={props.onUndo} /> : null}
    </li>
  );
}

type FeedProps = { map: WorkMap; list: ByApproveList | null; /** An admin undoes any record; anyone else, their own. */ admin: boolean; onUndo: (id: string) => Promise<string | null>; /** Today in Lima; a test fixes it. */ today?: string };

/** «Avances» (design ma05, José 28/11): every record, by Hoy / Semana / Todo; none waits for approval. */
export function ProgressFeed(props: FeedProps) {
  const [range, setRange] = useState<FeedRange>('hoy');
  const today = props.today ?? limaDayKey(new Date());
  const cards = useMemo(() => progressFeedOf(props.map, props.list, today, props.admin), [props.map, props.list, today, props.admin]);
  const shown = feedInRange(cards, range, today);
  return (
    <section data-testid="avances-lista" className="space-y-3">
      <p className={KICKER}>{FEED_TITLE}</p>
      <RangeTabs range={range} counts={feedCounts(cards, today)} onRange={setRange} />
      <Summary cards={shown} label={FEED_RANGES.find((option) => option.id === range)?.label ?? ''} />
      {shown.length ? <ul className="space-y-3">{shown.map((card) => <FeedRow key={card.id} card={card} onUndo={props.onUndo} />)}</ul> : <p className="text-[13px] text-on-surface-variant">{FEED_EMPTY}</p>}
    </section>
  );
}

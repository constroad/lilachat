import { useMemo, useState } from 'react';
import { Camera, TriangleAlert } from 'lucide-react';
import { FEED_EMPTY, FEED_RANGES, FEED_SUMMARY_KICKER, FEED_TITLE, feedCounts, feedInRange, feedSummaryOf, limaDayKey, progressFeedOf, resolvePendingProgress, type ByApproveList, type FeedCard, type FeedRange, type FeedState, type MapEditSend, type PendingDecision, type WorkMap } from '@lilachat/shared';
import { Decide, UndoProgress } from './PendingProgress';

const KICKER = 'text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant';
const PILL_TONE: Record<FeedState, string> = { pendiente: 'border-warning/40 bg-warning/10 text-warning', aprobado: 'border-en-linea/40 bg-en-linea/10 text-en-linea', rechazado: 'border-error/40 bg-error/10 text-error' };

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

type CardActions = { admin: boolean; onUndo: (id: string) => Promise<string | null>; onResolve: (id: string, decision: PendingDecision) => Promise<string | null> };

/** One progress: its work and street, chainages, metres, when and who, and its state. */
function FeedRow(props: { card: FeedCard; actions: CardActions }) {
  const { card, actions } = props;
  const [busy, setBusy] = useState<PendingDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolve = async (decision: PendingDecision) => { setBusy(decision); setError(await actions.onResolve(card.id, decision)); setBusy(null); };
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
        <span data-testid={`avance-estado-${card.id}`} className={`self-start rounded-md border px-2 py-1 text-[11px] font-bold ${PILL_TONE[card.state]}`}>{card.pill}</span>
      </div>
      {card.rejectNote ? <p className="flex items-center gap-2 rounded-xl border border-error/30 bg-error/5 p-3 text-[14px] text-error"><TriangleAlert size={16} className="shrink-0" />Nota: {card.rejectNote}</p> : null}
      {error ? <p role="alert" className="text-[13px] font-semibold text-error">{error}</p> : null}
      {card.undoable && card.toM !== null ? <UndoProgress id={card.id} toM={card.toM} onUndo={actions.onUndo} /> : null}
      {actions.admin && card.resolvable ? <Decide id={card.id} busy={busy} onResolve={(decision) => void resolve(decision)} /> : null}
    </li>
  );
}

type FeedProps = { map: WorkMap; list: ByApproveList | null; send: MapEditSend; admin: boolean; onUndo: (id: string) => Promise<string | null>; /** After «Aprobar» / «Rechazar»: the list and the map again. */ onChanged: () => void; /** Today in Lima; a test fixes it. */ today?: string };

/** «Avances» (design ma05, José 28/11): what waits, what was approved and what was refused, by Hoy / Semana / Todo. */
export function ProgressFeed(props: FeedProps) {
  const [range, setRange] = useState<FeedRange>('hoy');
  const today = props.today ?? limaDayKey(new Date());
  const cards = useMemo(() => progressFeedOf(props.map, props.list, today), [props.map, props.list, today]);
  const shown = feedInRange(cards, range, today);
  const onResolve = async (id: string, decision: PendingDecision) => {
    const failure = await resolvePendingProgress(props.send, id, decision);
    if (!failure) props.onChanged();
    return failure;
  };
  const actions: CardActions = { admin: props.admin, onUndo: props.onUndo, onResolve };
  return (
    <section data-testid="avances-lista" className="space-y-3">
      <p className={KICKER}>{FEED_TITLE}</p>
      <RangeTabs range={range} counts={feedCounts(cards, today)} onRange={setRange} />
      <Summary cards={shown} label={FEED_RANGES.find((option) => option.id === range)?.label ?? ''} />
      {shown.length ? <ul className="space-y-3">{shown.map((card) => <FeedRow key={card.id} card={card} actions={actions} />)}</ul> : <p className="text-[13px] text-on-surface-variant">{FEED_EMPTY}</p>}
    </section>
  );
}

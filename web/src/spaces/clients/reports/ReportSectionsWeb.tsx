import type { ReactNode } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { progressLine, progressOf, progressPercent, type FieldDocument, type ResultTone, type SectionResult, type SectionState, type StateBadge } from '@lilachat/shared';
import { DETAIL_TONE } from '../tones';

/** A result's number in its tone (design j-02: «1.02 lt/m²» green when in range). */
const RESULT_TONE: Record<ResultTone, string> = { ok: 'text-en-linea', warn: 'text-warning', error: 'text-error', neutral: 'text-on-surface' };
const DOT_TONE: Record<SectionState, string> = { done: 'border-en-linea bg-en-linea/10 text-en-linea', partial: 'border-warning bg-warning/10', error: 'border-error bg-error/10', empty: 'border-outline/30 bg-surface' };

export function Pill({ badge, testId }: { badge: StateBadge; testId?: string }) {
  return <span data-testid={testId} className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[badge.tone]}`}>{badge.label}</span>;
}

/** The circle at the left of a card: a check once done, a dot while partial, empty otherwise. */
export function StateDot({ state, small }: { state: SectionState; small?: boolean }) {
  const size = small ? 'h-5 w-5' : 'h-7 w-7';
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full border-2 ${DOT_TONE[state]}`}>
      {state === 'done' ? <Check size={small ? 11 : 14} /> : null}
      {state === 'partial' || state === 'error' ? <span className={`${small ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5'} rounded-full ${state === 'error' ? 'bg-error' : 'bg-warning'}`} /> : null}
    </span>
  );
}

/** What a section measured (the rate, the area), label over value, in a strip under the summary. */
export function ResultsStrip({ results, testId }: { results: readonly SectionResult[]; testId?: string }) {
  if (!results.length) return null;
  return (
    <div data-testid={testId} className="mt-3 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-outline/10 bg-background px-3 py-2.5">
      {results.map((result) => (
        <div key={result.label} className="min-w-[96px]">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{result.label}</p>
          <p className={`mt-0.5 font-mono text-[16px] font-bold tabular-nums ${RESULT_TONE[result.tone]}`}>{result.value}</p>
        </div>
      ))}
    </div>
  );
}

/** A section's card (design j-02): its state, its pill, what it says so far and what it measured; clicking opens it. */
export function SectionCard(props: { testId: string; title: string; badge: StateBadge; state: SectionState; summary: readonly string[]; results: readonly SectionResult[]; note?: string; onPress?: () => void; children?: ReactNode }) {
  return (
    <button type="button" data-testid={props.testId} onClick={props.onPress} disabled={!props.onPress} className={`flex w-full items-start gap-3 rounded-xl border border-outline/15 bg-surface p-4 text-left ${props.onPress ? 'hover:border-primary/40' : 'opacity-60'}`}>
      <StateDot state={props.state} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold">{props.title}</span>
          <Pill badge={props.badge} />
        </span>
        {props.summary.length ? <span className="mt-1 block text-sm text-on-surface-variant">{props.summary.join(' · ')}</span> : null}
        {props.note ? <span className="mt-1 block text-[13px] text-error">{props.note}</span> : null}
        <ResultsStrip results={props.results} />
        {props.children}
      </span>
      {props.onPress ? <ChevronRight size={18} className="shrink-0 text-on-surface-variant" /> : null}
    </button>
  );
}

/** «2 de 4 secciones listas» with its bar, on top of the hub. */
export function ProgressCard({ report }: { report: FieldDocument }) {
  const progress = progressOf(report);
  const percent = progressPercent(progress);
  return (
    <section data-testid="progreso-informe" className="rounded-xl border border-outline/15 bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-bold">{progressLine(progress)}</p>
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">{`${percent}%`}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
    </section>
  );
}

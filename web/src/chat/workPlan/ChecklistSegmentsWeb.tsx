import { useState } from 'react';
import { CHECKLIST_SEGMENT_LABELS, pendingTasks, type ChecklistSegment } from '@lilachat/shared';
import { WorkPlanWeb, type WorkPlanWebState } from './WorkPlanWeb';
import { PendingWeb, type OpenTask } from './WorkListsWeb';

const SEGMENTS: ChecklistSegment[] = ['pending', 'plan'];

/**
 * «Checklist» on a phone (José 19/11, design cc-06): «Pendientes · Plan» in one segmented control,
 * the open tasks first. «Pendientes» stops being a tab of its own there.
 */
export function ChecklistSegmentsWeb(props: { plan: WorkPlanWebState; onOpenTask: (task: OpenTask) => void }) {
  const [segment, setSegment] = useState<ChecklistSegment>('pending');
  const open = pendingTasks(props.plan.stages ?? [], new Date()).length;
  const summary = props.plan.summary;
  const counts: Record<ChecklistSegment, string> = { pending: String(open), plan: summary?.total ? `${summary.done}/${summary.total}` : '' };
  return (
    <div data-testid="checklist-segmentos" className="flex min-h-0 flex-1 flex-col bg-background">
      <div role="tablist" aria-label="Checklist" className="mx-4 mt-3 flex shrink-0 rounded-xl border border-outline/15 bg-background p-1">
        {SEGMENTS.map((key) => (
          <button key={key} type="button" role="tab" aria-selected={segment === key} data-testid={`checklist-segmento-${key}`} onClick={() => setSegment(key)} className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[14px] font-semibold ${segment === key ? 'bg-primary/15 text-primary shadow-sm ring-1 ring-primary/30' : 'text-on-surface-variant'}`}>
            {CHECKLIST_SEGMENT_LABELS[key]}
            {counts[key] ? <span className="font-mono text-[12px] tabular-nums">{counts[key]}</span> : null}
          </button>
        ))}
      </div>
      {segment === 'pending' ? <PendingWeb stages={props.plan.stages ?? []} onOpen={props.onOpenTask} /> : <WorkPlanWeb plan={props.plan} onOpenTask={props.onOpenTask} />}
    </div>
  );
}

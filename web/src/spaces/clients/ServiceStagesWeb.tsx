import { useState, type ReactNode } from 'react';
import { ChevronDown, Circle, CircleCheck, Clock } from 'lucide-react';
import { serviceStages, stagesDone, type ServiceDetail, type StageState } from '@lilachat/shared';

const ICON: Record<StageState, ReactNode> = {
  done: <CircleCheck size={18} className="shrink-0 text-en-linea" />,
  doing: <Clock size={18} className="shrink-0 text-warning" />,
  pending: <Circle size={18} className="shrink-0 text-outline" />,
};

/**
 * Where the service stands, read from Portal (José 30/10: how to measure what
 * is done and what is pending without ticking a checklist by hand). It folds
 * inside the progress card (José 30/10 night: «con un toggle»); closed by default.
 */
export function ServiceStagesWeb({ detail }: { detail: ServiceDetail }) {
  const [open, setOpen] = useState(false);
  const stages = serviceStages(detail);
  const progress = stagesDone(stages);
  return (
    <div data-testid="etapas-servicio" className="mt-3 border-t border-outline/10 pt-2">
      <button type="button" data-testid="etapas-toggle" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-[36px] w-full items-center gap-2 text-left">
        <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{`Etapas · ${progress.done} de ${progress.total}`}</span>
        <ChevronDown size={16} className={`text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <ul>
          {stages.map((stage) => (
            <li key={stage.key} data-testid={`etapa-${stage.key}-${stage.state}`} className="flex min-h-[36px] items-center gap-3">
              {ICON[stage.state]}
              <span className="w-24 shrink-0 text-sm font-semibold">{stage.label}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-on-surface-variant">{stage.line}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

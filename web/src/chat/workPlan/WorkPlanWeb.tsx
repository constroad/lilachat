import { Check, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { suscribirTarjeta, workPlanSummary, type StageStatus, type WorkPlanSummary, type WorkStage } from '@lilachat/shared';
import { api } from '../../api';
import { ChecklistEnElChat } from '../tarjetas/ChecklistEnElChat';

const STATUS_LABEL: Record<StageStatus, string> = { done: 'HECHO', in_progress: 'EN PROCESO', pending: 'PENDIENTE' };

/** A channel's checklist by stages (pending 21): read once, and again when any stage changes live. */
export function useWorkPlanWeb(jwt: string, chatId: string, enabled: boolean) {
  const [stages, setStages] = useState<WorkStage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(async () => {
    const response = await api<{ stages: WorkStage[] }>(`/agenda/checklists/stages?chatId=${chatId}`, { jwt });
    setFailed(!response.ok);
    if (response.ok) setStages(response.data.stages);
  }, [jwt, chatId]);
  useEffect(() => {
    setStages(null);
    if (enabled) void reload();
  }, [enabled, reload]);
  const stageIds = stages?.map((one) => one._id).join(',') ?? '';
  useEffect(() => {
    if (!stageIds) return;
    const unsubscribes = stageIds.split(',').map((id) => suscribirTarjeta('checklist', id, () => void reload()));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [stageIds, reload]);
  const summary = useMemo(() => (stages ? workPlanSummary(stages, new Date()) : null), [stages]);
  const start = useCallback(async () => {
    const response = await api<{ stages: number }>('/agenda/checklists/stages', { jwt, body: { chatId } });
    if (!response.ok && response.status !== 409) return response.message;
    await reload();
    return null;
  }, [jwt, chatId, reload]);
  return { stages, summary, failed, start, reload };
}

export type WorkPlanWebState = ReturnType<typeof useWorkPlanWeb>;

/** The «Checklist» tab of a channel on the web (design e2-17, desktop). */
export function WorkPlanWeb({ plan, onOpenTask }: { plan: WorkPlanWebState; onOpenTask: (task: { stageId: string; itemId: string }) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (plan.stages === null) return <p className="min-h-0 flex-1 pt-10 text-center text-sm text-on-surface-variant">{plan.failed ? 'No se pudo cargar el checklist.' : 'Cargando…'}</p>;
  if (plan.stages.length === 0) {
    return (
      <div data-testid="checklist-de-obra-vacio" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <ClipboardList className="text-primary" size={40} />
        <p className="text-lg font-bold">Maneja la obra por etapas</p>
        <p className="max-w-md text-sm text-on-surface-variant">Cotización, orden de compra, ejecución, valorizaciones, pagos, informes y observaciones. Cada etapa con sus tareas, responsable y fecha.</p>
        <button type="button" data-testid="btn-armar-checklist-de-obra" onClick={() => void plan.start().then((message) => setError(message ?? ''))} className="min-h-[44px] rounded-xl bg-primary px-5 font-semibold text-on-primary">
          Armar el checklist de la obra
        </button>
        {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
      </div>
    );
  }
  const summary = plan.summary!;
  const expanded = open ?? summary.current?.id ?? null;
  return (
    <div data-testid="checklist-de-obra" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <SummaryWeb summary={summary} />
        <div className="mt-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Checklist por etapas</p>
          <p className="text-lg font-bold">Flujo técnico y control</p>
        </div>
        {summary.stages.map((stage) => {
          const isOpen = expanded === stage.id;
          const done = stage.status === 'done';
          return (
            <section key={stage.id} className={`overflow-hidden rounded-2xl border bg-surface ${isOpen ? 'border-primary/50' : 'border-outline/15'}`}>
              <button type="button" data-testid={`etapa-${stage.stage}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : stage.id)} className="w-full px-4 py-3 text-left">
                <span className="flex items-center gap-3">
                  <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${done ? 'bg-en-linea/15 text-en-linea' : isOpen ? 'bg-primary text-on-primary' : 'bg-primary/10 text-primary'}`}>{done ? <Check size={16} /> : stage.stage}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{`${stage.stage}. ${stage.title}`}</span>
                    <span className="block text-[13px] text-on-surface-variant">{stage.total ? `${stage.done} de ${stage.total} ítems completados` : 'Sin tareas todavía'}</span>
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${done ? 'border-en-linea/30 bg-en-linea/10 text-en-linea' : 'border-outline/20 text-on-surface-variant'}`}>{STATUS_LABEL[stage.status]}</span>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
                <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-primary/10">
                  <span className={`block h-full rounded-full ${done ? 'bg-en-linea' : 'bg-primary'}`} style={{ width: `${stage.total ? (stage.done / stage.total) * 100 : 0}%` }} />
                </span>
              </button>
              {isOpen ? <div className="px-3 pb-3"><ChecklistEnElChat id={stage.id} onOpenTask={(item) => onOpenTask({ stageId: stage.id, itemId: item.id })} /></div> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SummaryWeb({ summary }: { summary: WorkPlanSummary }) {
  const cells = [
    { label: 'Etapa actual', value: summary.current?.title ?? 'Terminada', hint: summary.current ? `ETAPA ${summary.current.stage}` : '', tone: '' },
    { label: 'Avance', value: `${summary.percent}%`, hint: `${summary.done} de ${summary.total} ítems`, tone: '' },
    { label: 'Pendientes', value: String(summary.pending), hint: 'en curso', tone: 'text-warning' },
    { label: 'Vencidos', value: String(summary.overdue), hint: summary.overdue ? '¡Acción!' : 'al día', tone: summary.overdue ? 'text-error' : '' },
  ];
  return (
    <div data-testid="resumen-de-obra" className="grid grid-cols-4 divide-x divide-outline/10 rounded-2xl border border-outline/15 bg-surface py-3">
      {cells.map((cell) => (
        <div key={cell.label} className="px-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{cell.label}</p>
          <p className={`mt-1 font-bold tabular-nums ${cell.label === 'Etapa actual' ? 'text-sm' : 'text-xl'} ${cell.tone}`}>{cell.value}</p>
          {cell.hint ? <p className="text-[11px] text-on-surface-variant">{cell.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

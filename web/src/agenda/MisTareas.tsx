import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { myTasks, taskCountLabel, taskDueLabel, type AgendaChecklist, type MyTask, type MyTaskGroup } from '@lilachat/shared';
import { api } from '../api';

const GROUP_TITLE: Record<MyTaskGroup['state'], string> = { overdue: 'Atrasadas', today: 'Hoy', upcoming: 'Próximas', none: 'Sin fecha' };
/** Each group's tone in the design (`k-04-mis-tareas`): late in red, today in amber, the rest neutral. */
const TONE: Record<MyTaskGroup['state'], { label: string; ring: string; pill: string }> = {
  overdue: { label: 'text-error', ring: 'border-error', pill: 'border-error/30 bg-error/10 text-error' },
  today: { label: 'text-warning', ring: 'border-warning', pill: 'border-warning/30 bg-warning/10 text-warning' },
  upcoming: { label: 'text-on-surface-variant', ring: 'border-outline/40', pill: 'border-outline/30 bg-background text-on-surface-variant' },
  none: { label: 'text-on-surface-variant', ring: 'border-outline/40', pill: '' },
};

/**
 * «Mis tareas» on the web, like the app (backlog 30; design `k-04-mis-tareas`):
 * what was assigned to me, overdue first; ticked from here, and a click opens
 * the chat on its checklist.
 */
export function MisTareas(props: { jwt: string; me: string; chatNameOf: (chatId: string) => string; onOpen: (chatId: string, seq?: number) => void }) {
  const [checklists, setChecklists] = useState<AgendaChecklist[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [ticking, setTicking] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await api<{ checklists: AgendaChecklist[] }>('/agenda/checklists/mine', { jwt: props.jwt });
    if (response.ok) {
      setChecklists(response.data.checklists);
      setFailed(false);
    } else setFailed(true);
  }, [props.jwt]);
  useEffect(() => {
    void load();
  }, [load]);
  const tick = async (task: MyTask) => {
    setTicking(task.item.id);
    await api(`/agenda/checklists/${task.checklistId}/items/${task.item.id}/toggle`, { method: 'POST', jwt: props.jwt });
    await load();
    setTicking(null);
  };

  if (checklists === null) return failed ? <button type="button" onClick={() => void load()} className="text-[13px] text-error underline">No se pudieron cargar tus tareas. Reintentar</button> : <div className="h-24 animate-pulse rounded-xl bg-background" />;
  const groups = myTasks(checklists, props.me, new Date());
  if (groups.length === 0) {
    return (
      <div data-testid="mis-tareas-vacio" className="flex flex-col items-center py-8 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><ClipboardCheck size={24} /></span>
        <p className="mt-3 font-semibold">No tienes tareas</p>
        <p className="mt-1 text-sm text-on-surface-variant">Cuando alguien te ponga a cargo de una tarea de un checklist, aparece aquí.</p>
      </div>
    );
  }
  return (
    <div data-testid="mis-tareas">
      {groups.map((group) => (
        <section key={group.state} data-testid={`tareas-${group.state}`}>
          <p className={`mb-2 mt-4 flex items-center justify-between text-[12px] ${TONE[group.state].label}`}>
            <span className="font-bold uppercase tracking-wider">{GROUP_TITLE[group.state]}</span>
            <span className="font-semibold">{taskCountLabel(group.tasks.length)}</span>
          </p>
          {group.tasks.map((task) => {
            const seq = checklists.find((checklist) => checklist._id === task.checklistId)?.cardSeq;
            return (
              <div key={`${task.checklistId}-${task.item.id}`} className="mb-2 flex min-h-[60px] items-center gap-3 rounded-xl border border-outline/15 bg-surface px-3 py-2">
                <button type="button" data-testid={`marcar-tarea-${task.item.id}`} aria-label={`Marcar «${task.item.text}» como hecha`} disabled={ticking !== null} onClick={() => void tick(task)} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${ticking === task.item.id ? 'bg-primary' : `border-2 ${TONE[group.state].ring} hover:border-primary`}`} />
                <button type="button" data-testid={`mi-tarea-${task.item.id}`} onClick={() => props.onOpen(task.chatId, seq)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold">{task.item.text}</span>
                  <span className="block truncate text-[12px] text-on-surface-variant">{`${task.checklistTitle} · ${props.chatNameOf(task.chatId)}`}</span>
                </button>
                {task.item.dueAt ? <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-bold uppercase ${TONE[group.state].pill}`}>{taskDueLabel(task.item.dueAt, new Date())}</span> : null}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

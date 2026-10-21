import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { myTasks, taskDueLabel, type AgendaChecklist, type MyTask, type MyTaskGroup } from '@lilachat/shared';
import { api } from '../api';

const GROUP_TITLE: Record<MyTaskGroup['state'], string> = { overdue: 'Atrasadas', today: 'Hoy', upcoming: 'Próximas', none: 'Sin fecha' };
const PILL: Record<MyTaskGroup['state'], string> = { overdue: 'bg-error/10 font-bold text-error', today: 'bg-primary/10 font-semibold text-primary', upcoming: 'bg-background text-on-surface-variant', none: '' };

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
          <p className={`mb-2 mt-3 text-[11px] font-bold uppercase tracking-wider ${group.state === 'overdue' ? 'text-error' : 'text-primary'}`}>{`${GROUP_TITLE[group.state]} · ${group.tasks.length}`}</p>
          {group.tasks.map((task) => {
            const seq = checklists.find((checklist) => checklist._id === task.checklistId)?.cardSeq;
            return (
              <div key={`${task.checklistId}-${task.item.id}`} className="mb-2 flex min-h-[60px] items-center gap-3 rounded-xl border border-outline/15 bg-surface px-3 py-2">
                <button type="button" data-testid={`marcar-tarea-${task.item.id}`} aria-label={`Marcar «${task.item.text}» como hecha`} disabled={ticking !== null} onClick={() => void tick(task)} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${ticking === task.item.id ? 'bg-primary' : 'border-2 border-outline/40 hover:border-primary'}`} />
                <button type="button" data-testid={`mi-tarea-${task.item.id}`} onClick={() => props.onOpen(task.chatId, seq)} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold">{task.item.text}</span>
                  <span className="block truncate text-[12px] text-on-surface-variant">{`${task.checklistTitle} · ${props.chatNameOf(task.chatId)}`}</span>
                </button>
                {task.item.dueAt ? <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] ${PILL[group.state]}`}>{taskDueLabel(task.item.dueAt, new Date())}</span> : null}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

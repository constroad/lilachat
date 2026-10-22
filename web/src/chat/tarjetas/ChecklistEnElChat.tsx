import { useState } from 'react';
import { Check, ClipboardCheck, EllipsisVertical, Pencil, Plus } from 'lucide-react';
import { CHECKLIST_LIMITS, canToggleTask, checklistMembers, checklistPermissions, checklistProgress, formatClock, taskDueLabel, taskDueState, toggleChecklistItem, validateChecklistItem, type AgendaChecklist, type ChecklistItem } from '@lilachat/shared';
import { api } from '../../api';
import { useConversacion } from '../contextoDeLaConversacion';
import { useTarjeta } from './useTarjeta';
import { TaskDialog, type TaskEdit } from './TaskDialog';
import { ChecklistOptionsDialog, type ChecklistEdit } from './ChecklistOptionsDialog';

/** The date pill by state: late in the error tone, today in the accent, later in grey. */
const PILL = { overdue: 'bg-error/10 font-bold text-error', today: 'bg-primary/10 font-semibold text-primary', upcoming: 'bg-background text-on-surface-variant' } as const;

/**
 * A checklist in the chat on the web, like the app's (backlog 8, José 21/10;
 * design `k-01-checklist-en-el-chat`): progress, tasks with who ticked each
 * and when, and «Agregar tarea». A tick shows at once and goes back if the
 * server refuses it; every change arrives live (`ref.changed`).
 */
export function ChecklistEnElChat({ id }: { id: string }) {
  const { jwt, yo, nombres } = useConversacion();
  const { valor: checklist, fallo, cargar, reemplazar } = useTarjeta<AgendaChecklist>({ tipo: 'checklist', id, ruta: `/agenda/checklists/${id}`, campo: 'checklist', jwt });
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChecklistItem | null>(null);
  /** A snapshot: a live change does not wipe what is being typed. */
  const [options, setOptions] = useState<AgendaChecklist | null>(null);

  if (checklist === null) return <p className="text-[13px] italic text-on-surface-variant">Este checklist ya no está disponible.</p>;
  if (checklist === undefined) {
    return fallo ? (
      <button type="button" onClick={() => void cargar()} className="text-[13px] text-on-surface-variant underline">No se pudo cargar el checklist. Reintentar</button>
    ) : (
      <div className="h-32 animate-pulse rounded-lg bg-background" />
    );
  }

  const { canAdd } = checklistPermissions({ me: yo, createdBy: checklist.createdBy, othersCanMark: checklist.othersCanMark, othersCanAdd: checklist.othersCanAdd });
  const progress = checklistProgress(checklist.items);
  const toggle = async (itemId: string) => {
    const optimistic = toggleChecklistItem(checklist.items, itemId, yo, new Date());
    if (!optimistic.ok) return;
    const before = checklist;
    reemplazar({ ...checklist, items: optimistic.items });
    setError('');
    const response = await api<{ checklist: AgendaChecklist }>(`/agenda/checklists/${id}/items/${itemId}/toggle`, { method: 'POST', jwt });
    if (response.ok) reemplazar(response.data.checklist);
    else {
      reemplazar(before);
      setError(response.message ?? 'No se pudo marcar la tarea.');
      if (response.status === 409) void cargar();
    }
  };
  /** Who does it and for when (backlog 30): shown at once, back if the server refuses. */
  const saveTask = async (itemId: string, edit: TaskEdit) => {
    const before = checklist;
    reemplazar({ ...checklist, items: checklist.items.map((item) => (item.id === itemId ? { ...item, ...edit } : item)) });
    setError('');
    const response = await api<{ checklist: AgendaChecklist }>(`/agenda/checklists/${id}/items/${itemId}`, { method: 'PATCH', jwt, body: edit });
    if (response.ok) reemplazar(response.data.checklist);
    else {
      reemplazar(before);
      setError(response.message ?? 'No se pudo guardar la tarea.');
    }
  };
  const removeTask = async (itemId: string) => {
    const response = await api<{ checklist: AgendaChecklist }>(`/agenda/checklists/${id}/items/${itemId}`, { method: 'DELETE', jwt });
    if (response.ok) reemplazar(response.data.checklist);
    else setError(response.message ?? 'No se pudo quitar la tarea.');
  };
  /** Its author renames it or changes who ticks and adds (José, 21/10). */
  const saveChecklist = async (edit: ChecklistEdit) => {
    const before = checklist;
    reemplazar({ ...checklist, ...edit });
    setError('');
    const response = await api<{ checklist: AgendaChecklist }>(`/agenda/checklists/${id}`, { method: 'PATCH', jwt, body: edit });
    if (response.ok) reemplazar(response.data.checklist);
    else {
      reemplazar(before);
      setError(response.message ?? 'No se pudo guardar el checklist.');
    }
  };
  const deleteChecklist = async () => {
    const response = await api<{ ok: true }>(`/agenda/checklists/${id}`, { method: 'DELETE', jwt });
    if (response.ok) reemplazar(null);
    else setError(response.message ?? 'No se pudo eliminar el checklist.');
  };
  const nameOf = (userId: string) => (userId === yo ? 'Tú' : (nombres.get(userId) ?? 'Alguien'));
  const add = async () => {
    const valid = validateChecklistItem(adding ?? '', checklist.items);
    if (!valid.ok) return setError(valid.message);
    const response = await api<{ checklist: AgendaChecklist }>(`/agenda/checklists/${id}/items`, { jwt, body: { text: valid.text } });
    if (!response.ok) return setError(response.message ?? 'No se pudo agregar la tarea.');
    reemplazar(response.data.checklist);
    setAdding(null);
    setError('');
  };

  return (
    <div data-testid={`checklist-${id}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"><ClipboardCheck size={14} />Checklist</p>
          <p className="mt-0.5 text-[16px] font-bold">{checklist.title}</p>
        </div>
        <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[12px] font-bold text-primary">{`${progress.done} de ${progress.total} listas`}</span>
        {checklist.createdBy === yo ? (
          <button type="button" data-testid="checklist-opciones" aria-label="Editar o eliminar el checklist" onClick={() => setOptions(checklist)} className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-background">
            <EllipsisVertical size={16} />
          </button>
        ) : null}
      </div>
      <div className="mb-1 mt-2.5 h-1.5 overflow-hidden rounded-full bg-primary/10">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
      </div>
      <ul>
        {checklist.items.map((item, index) => {
          // An assigned task is ticked by its person or the author (José, 21/10).
          const canTick = canToggleTask({ me: yo, createdBy: checklist.createdBy, othersCanMark: checklist.othersCanMark, assignee: item.assignee });
          return (
          <li key={item.id} className={`group flex items-center ${index > 0 ? 'border-t border-outline/10' : ''}`}>
            {/* Two targets (José, 21/10: «está inestable el editar con el marcar»): the circle ticks, the text edits. */}
            <button type="button" data-testid={`checklist-marcar-${index}`} role="checkbox" aria-checked={Boolean(item.doneBy)} aria-label={item.text} disabled={!canTick} title={canTick || !item.assignee ? undefined : `Es de ${nameOf(item.assignee)}: solo esa persona o quien creó el checklist la marca.`} onClick={() => void toggle(item.id)} className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-background disabled:cursor-default disabled:opacity-40">
              <span className={`grid h-5 w-5 place-items-center rounded-full ${item.doneBy ? 'bg-primary text-on-primary' : 'border-2 border-outline/40'}`}>{item.doneBy ? <Check size={12} strokeWidth={3} /> : null}</span>
            </button>
            <button type="button" data-testid={`checklist-tarea-${index}`} disabled={!canAdd} onClick={() => setEditing(item)} title={canAdd ? 'Editar la tarea' : undefined} className="min-w-0 flex-1 py-2 text-left disabled:cursor-default">
              <span className={`block text-[14px] ${item.doneBy ? 'text-on-surface-variant line-through' : ''}`}>{item.text}</span>
              {item.doneBy && item.doneAt ? (
                <span className="block text-[12px] text-on-surface-variant">{`Hecha por ${item.doneBy === yo ? 'ti' : nameOf(item.doneBy)} · ${formatClock(item.doneAt)}`}</span>
              ) : (
                <TaskMetaLine item={item} name={item.assignee ? nameOf(item.assignee) : null} />
              )}
            </button>
            {canAdd ? (
              <button type="button" data-testid={`checklist-editar-${index}`} aria-label={`Responsable y fecha de «${item.text}»`} onClick={() => setEditing(item)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-on-surface-variant opacity-60 hover:bg-background hover:opacity-100 group-hover:opacity-100">
                <Pencil size={15} />
              </button>
            ) : null}
          </li>
          );
        })}
      </ul>
      {canAdd && checklist.items.length < CHECKLIST_LIMITS.items ? (
        adding === null ? (
          <button type="button" data-testid="checklist-agregar" onClick={() => setAdding('')} className="flex min-h-[40px] w-full items-center gap-2 border-t border-outline/10 text-[14px] font-semibold text-primary">
            <Plus size={16} />
            Agregar tarea
          </button>
        ) : (
          <form className="flex items-center gap-2 border-t border-outline/10 py-2" onSubmit={(event) => { event.preventDefault(); void add(); }}>
            <input data-testid="checklist-nueva-tarea" autoFocus value={adding} maxLength={CHECKLIST_LIMITS.item} onChange={(event) => setAdding(event.target.value)} placeholder="Nueva tarea" className="h-9 min-w-0 flex-1 rounded-lg bg-primary/[0.07] px-3 text-[14px] outline-none" />
            <button type="submit" className="h-9 rounded-full bg-primary px-4 text-[13px] font-bold text-on-primary">Agregar</button>
          </form>
        )
      ) : null}
      {error ? <p className="pt-1 text-[12px] text-error">{error}</p> : null}
      {options ? <ChecklistOptionsDialog checklist={options} onSave={(edit) => void saveChecklist(edit)} onDelete={() => void deleteChecklist()} onClose={() => setOptions(null)} /> : null}
      {editing ? <TaskDialog item={editing} members={checklistMembers(nombres, yo)} canRemove={checklist.items.length > 1} onSave={(edit) => void saveTask(editing.id, edit)} onRemove={() => void removeTask(editing.id)} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

/** Under a pending task (design `k-03`): who does it and the date as a pill. */
function TaskMetaLine({ item, name }: { item: ChecklistItem; name: string | null }) {
  const now = new Date();
  const state = taskDueState(item, now);
  const pill = state === 'overdue' || state === 'today' || state === 'upcoming' ? PILL[state] : null;
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px]">
      <span className={name ? '' : 'text-on-surface-variant/70'}>{name ?? 'Sin responsable'}</span>
      {pill && item.dueAt ? <span className={`rounded-md px-1.5 py-px text-[11px] ${pill}`}>{taskDueLabel(item.dueAt, now)}</span> : null}
    </span>
  );
}

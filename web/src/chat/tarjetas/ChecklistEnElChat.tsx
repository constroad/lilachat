import { useState } from 'react';
import { Check, ClipboardCheck, Plus } from 'lucide-react';
import { CHECKLIST_LIMITS, checklistPermissions, checklistProgress, formatClock, toggleChecklistItem, validateChecklistItem, type AgendaChecklist } from '@lilachat/shared';
import { api } from '../../api';
import { useConversacion } from '../contextoDeLaConversacion';
import { useTarjeta } from './useTarjeta';

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

  if (checklist === null) return <p className="text-[13px] italic text-on-surface-variant">Este checklist ya no está disponible.</p>;
  if (checklist === undefined) {
    return fallo ? (
      <button type="button" onClick={() => void cargar()} className="text-[13px] text-on-surface-variant underline">No se pudo cargar el checklist. Reintentar</button>
    ) : (
      <div className="h-32 animate-pulse rounded-lg bg-background" />
    );
  }

  const { canMark, canAdd } = checklistPermissions({ me: yo, createdBy: checklist.createdBy, othersCanMark: checklist.othersCanMark, othersCanAdd: checklist.othersCanAdd });
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
      </div>
      <div className="mb-1 mt-2.5 h-1.5 overflow-hidden rounded-full bg-primary/10">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
      </div>
      <ul>
        {checklist.items.map((item, index) => (
          <li key={item.id} className={index > 0 ? 'border-t border-outline/10' : ''}>
            <button type="button" data-testid={`checklist-tarea-${index}`} disabled={!canMark} onClick={() => void toggle(item.id)} className="flex min-h-[44px] w-full items-center gap-3 py-2 text-left disabled:cursor-default">
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${item.doneBy ? 'bg-primary text-on-primary' : 'border-2 border-outline/40'}`}>{item.doneBy ? <Check size={12} strokeWidth={3} /> : null}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[14px] ${item.doneBy ? 'text-on-surface-variant line-through' : ''}`}>{item.text}</span>
                {item.doneBy && item.doneAt ? <span className="block text-[12px] text-on-surface-variant">{`${item.doneBy === yo ? 'Tú' : (nombres.get(item.doneBy) ?? 'Alguien')} · ${formatClock(item.doneAt)}`}</span> : null}
              </span>
            </button>
          </li>
        ))}
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
    </div>
  );
}

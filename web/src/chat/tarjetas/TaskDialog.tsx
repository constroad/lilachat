import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, Check, Trash2, X } from 'lucide-react';
import { CHECKLIST_LIMITS, activeDueChoice, shortPersonName, taskDueOptions, type ChecklistItem } from '@lilachat/shared';
import { Overlay } from '../../ui/Overlay';
import { Avatar } from '../../ui/Avatar';

export type TaskEdit = { text: string; assignee: string | null; dueAt: string | null };

/** A date picked by hand is due at the end of that working day. */
const PICKED_DUE_HOUR = 18;
const toDateInput = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * A task's dialog on the web, like the app's sheet (backlog 30; design
 * `k-03-checklist-responsables`): who does it and for when, a draft until
 * «Guardar cambios». In a portal: inside the bubble a `fixed` would be clipped.
 */
export function TaskDialog(props: { item: ChecklistItem; members: readonly { id: string; name: string }[]; canRemove: boolean; onSave: (edit: TaskEdit) => void; onRemove: () => void; onClose: () => void }) {
  const [text, setText] = useState(props.item.text);
  const [assignee, setAssignee] = useState<string | null>(props.item.assignee ?? null);
  const [dueAt, setDueAt] = useState<string | null>(props.item.dueAt ?? null);
  const options = useMemo(() => taskDueOptions(new Date()), []);
  const active = activeDueChoice(dueAt, options);
  const assigneeName = props.members.find((member) => member.id === assignee)?.name;
  const chip = (lit: boolean) => `inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3.5 text-[14px] ${lit ? 'border-primary bg-primary font-semibold text-on-primary' : 'border-outline/25 text-on-surface-variant hover:bg-background'}`;
  const person = (id: string | null, name: string, avatar: React.ReactNode) => (
    <button key={id ?? 'nadie'} type="button" data-testid={`responsable-${id ?? 'nadie'}`} aria-pressed={assignee === id} onClick={() => setAssignee(id)} className={`flex w-[72px] shrink-0 flex-col items-center rounded-xl border py-1.5 ${assignee === id ? 'border-primary bg-primary/[0.06]' : 'border-transparent hover:bg-background'}`}>
      {avatar}
      <span className={`mt-1 max-w-full truncate text-[12px] ${assignee === id ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{name}</span>
    </button>
  );

  // React events still bubble through a portal: they must not reach the bubble (selection, long press).
  return createPortal(
    <div onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
    <Overlay
      title="Editar tarea"
      onClose={props.onClose}
      footer={
        <div className="flex flex-col gap-2">
          <button type="button" data-testid="tarea-guardar" disabled={!text.trim()} onClick={() => { props.onSave({ text: text.trim(), assignee, dueAt }); props.onClose(); }} className="h-11 rounded-xl bg-primary text-[15px] font-bold text-on-primary disabled:opacity-50">Guardar cambios</button>
          {props.canRemove ? (
            <button type="button" data-testid="tarea-quitar" onClick={() => { props.onRemove(); props.onClose(); }} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-error/40 bg-error/[0.06] text-[15px] font-semibold text-error"><Trash2 size={17} />Quitar la tarea</button>
          ) : null}
        </div>
      }
    >
      <input data-testid="tarea-texto" aria-label="Texto de la tarea" value={text} maxLength={CHECKLIST_LIMITS.item} onChange={(event) => setText(event.target.value)} className="mb-3 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-[15px] font-semibold outline-none focus:border-primary" />
      <div className="flex items-center justify-between pb-2">
        <p className="text-[13px] font-bold uppercase tracking-wide">Responsable</p>
        {assigneeName ? <p className="text-[13px] font-semibold text-primary">{`Asignado: ${assigneeName}`}</p> : null}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-3">
        {props.members.map((member) => person(member.id, shortPersonName(member.name), <Avatar name={member.name} size={44} />))}
        {person(null, 'Nadie', <span className="grid h-11 w-11 place-items-center rounded-full border border-outline/25 text-on-surface-variant"><X size={18} /></span>)}
      </div>
      <p className="border-t border-outline/15 pb-2 pt-3 text-[13px] font-bold uppercase tracking-wide">Para cuándo</p>
      <div className="flex flex-wrap gap-2 pb-2">
        {options.map((option) => (
          <button key={option.id} type="button" data-testid={`tarea-${option.id}`} aria-pressed={active === option.id} onClick={() => setDueAt(option.date.toISOString())} className={chip(active === option.id)}>
            {option.label}
            {active === option.id ? <Check size={15} strokeWidth={3} /> : null}
          </button>
        ))}
        <label className={`${chip(active === 'custom')} cursor-pointer`}>
          <CalendarClock size={16} />
          <span className="sr-only">Elegir fecha</span>
          <input data-testid="tarea-elegir-fecha" type="date" min={toDateInput(new Date().toISOString())} value={active === 'custom' && dueAt ? toDateInput(dueAt) : ''} onChange={(event) => {
            const [year, month, day] = event.target.value.split('-').map(Number);
            if (year && month && day) setDueAt(new Date(year, month - 1, day, PICKED_DUE_HOUR).toISOString());
          }} className="bg-transparent text-[14px] outline-none [color-scheme:light_dark]" />
        </label>
        <button type="button" data-testid="tarea-sin-fecha" aria-pressed={active === 'none'} onClick={() => setDueAt(null)} className={chip(active === 'none')}>Sin fecha</button>
      </div>
    </Overlay>
    </div>,
    document.body,
  );
}

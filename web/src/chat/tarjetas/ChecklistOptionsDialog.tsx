import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { CHECKLIST_LIMITS, type AgendaChecklist } from '@lilachat/shared';
import { Overlay } from '../../ui/Overlay';

export type ChecklistEdit = { title: string; othersCanMark: boolean; othersCanAdd: boolean };

/**
 * The checklist's own options on the web, for whoever made it (José, 21/10):
 * title, who ticks and adds, and deleting it after a confirmation.
 */
export function ChecklistOptionsDialog(props: { checklist: AgendaChecklist; onSave: (edit: ChecklistEdit) => void; onDelete: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(props.checklist.title);
  const [othersCanMark, setOthersCanMark] = useState(props.checklist.othersCanMark);
  const [othersCanAdd, setOthersCanAdd] = useState(props.checklist.othersCanAdd);
  const [confirming, setConfirming] = useState(false);
  const toggle = (testId: string, label: string, hint: string, value: boolean, onChange: (next: boolean) => void) => (
    <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-outline/15 p-3">
      <input type="checkbox" data-testid={testId} checked={value} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
      <span><span className="block text-sm font-semibold">{label}</span><span className="block text-[12px] text-on-surface-variant">{hint}</span></span>
    </label>
  );
  // React events still bubble through a portal: they must not reach the bubble.
  return createPortal(
    <div onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
      <Overlay
        title="Editar checklist"
        onClose={props.onClose}
        footer={
          confirming ? (
            <div className="flex flex-col gap-2" role="alert">
              <p className="text-sm">Se borra para todos los del chat, con sus tareas. No se puede deshacer.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirming(false)} className="h-11 rounded-xl border border-outline/25 text-sm font-semibold">Cancelar</button>
                <button type="button" data-testid="opciones-checklist-confirmar" onClick={() => { props.onDelete(); props.onClose(); }} className="h-11 rounded-xl bg-error text-sm font-bold text-white">Eliminar</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button type="button" data-testid="opciones-checklist-guardar" disabled={!title.trim()} onClick={() => { props.onSave({ title: title.trim(), othersCanMark, othersCanAdd }); props.onClose(); }} className="h-11 rounded-xl bg-primary text-[15px] font-bold text-on-primary disabled:opacity-50">Guardar cambios</button>
              <button type="button" data-testid="opciones-checklist-eliminar" onClick={() => setConfirming(true)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-error/40 bg-error/[0.06] text-[15px] font-semibold text-error"><Trash2 size={17} />Eliminar el checklist</button>
            </div>
          )
        }
      >
        <label className="block text-[12px] font-semibold text-on-surface-variant">
          Título
          <input data-testid="opciones-checklist-titulo" value={title} maxLength={CHECKLIST_LIMITS.title} onChange={(event) => setTitle(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm text-on-surface outline-none focus:border-primary" />
        </label>
        {toggle('opciones-switch-marcar', 'Los demás pueden marcar tareas', 'Si lo apagas, solo tú las marcas', othersCanMark, setOthersCanMark)}
        {toggle('opciones-switch-agregar', 'Los demás pueden agregar y editar tareas', 'Responsables, fechas y tareas nuevas', othersCanAdd, setOthersCanAdd)}
      </Overlay>
    </div>,
    document.body,
  );
}

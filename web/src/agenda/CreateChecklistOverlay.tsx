import { useState } from 'react';
import { Circle, Plus, X } from 'lucide-react';
import { CHECKLIST_LIMITS, validateChecklist } from '@lilachat/shared';
import { api } from '../api';
import { FieldError, Overlay, PrimaryButton } from '../ui/Overlay';

const FIELD = 'h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary';

/**
 * A new checklist in the open chat, on the web (backlog 8, José 21/10; design
 * `k-02-crear-checklist`): title, tasks and whether the others tick and add.
 * Pinned by default (backlog 30); from a thread (`threadOf`) it stays there, unpinned.
 */
export function CreateChecklistOverlay({ jwt, chatId, threadOf, onClose }: { jwt: string; chatId: string; threadOf?: number; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [items, setItems] = useState(['', '', '']);
  const [othersCanMark, setOthersCanMark] = useState(true);
  const [othersCanAdd, setOthersCanAdd] = useState(true);
  const [pin, setPin] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const send = async () => {
    if (saving) return;
    const valid = validateChecklist({ title, items });
    if (!valid.ok) return setError(valid.message);
    setSaving(true);
    const result = await api<{ id: string }>('/agenda/checklists', { jwt, body: { chatId, title: valid.title, items: valid.items, othersCanMark, othersCanAdd, ...(threadOf === undefined ? { pin } : { hiloDe: threadOf }) } });
    setSaving(false);
    if (!result.ok) return setError(result.message ?? 'No se pudo enviar el checklist.');
    onClose();
  };
  const setItem = (index: number, text: string) => {
    setItems((current) => current.map((one, position) => (position === index ? text : one)));
    setError('');
  };

  return (
    <Overlay
      title="Nuevo checklist"
      onClose={onClose}
      footer={
        <>
          <PrimaryButton testId="btn-enviar-checklist" onClick={() => void send()} disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar checklist'}
          </PrimaryButton>
          <FieldError>{error}</FieldError>
        </>
      }
    >
      <label className="block">
        <span className="text-[12px] font-semibold text-on-surface-variant">Título del checklist</span>
        <input data-testid="checklist-titulo" value={title} maxLength={CHECKLIST_LIMITS.title} onChange={(event) => { setTitle(event.target.value); setError(''); }} placeholder="Vaciado de losa · jueves" className={`mt-1 ${FIELD}`} />
      </label>
      <fieldset className="mt-4">
        <legend className="text-[12px] font-semibold text-on-surface-variant">{`Tareas (${items.filter((item) => item.trim()).length} de ${CHECKLIST_LIMITS.items})`}</legend>
        {items.map((item, index) => (
          <div key={index} className="mt-1.5 flex items-center gap-2">
            <Circle size={18} className="shrink-0 text-outline" />
            <input data-testid={`checklist-tarea-input-${index}`} value={item} maxLength={CHECKLIST_LIMITS.item} onChange={(event) => setItem(index, event.target.value)} placeholder={index === items.length - 1 ? 'Agregar tarea' : `Tarea ${index + 1}`} className={`min-w-0 flex-1 ${FIELD}`} />
            {items.length > 1 ? (
              <button type="button" aria-label={`Quitar la tarea ${index + 1}`} onClick={() => setItems((current) => current.filter((_, position) => position !== index))} className="grid h-11 w-9 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-background">
                <X size={16} />
              </button>
            ) : null}
          </div>
        ))}
        {items.length < CHECKLIST_LIMITS.items ? (
          <button type="button" data-testid="checklist-otra-tarea" onClick={() => setItems((current) => [...current, ''])} className="mt-2 flex h-10 items-center gap-2 text-sm font-semibold text-primary">
            <Plus size={16} /> Agregar otra tarea
          </button>
        ) : null}
      </fieldset>
      <fieldset className="mt-4 space-y-2">
        <legend className="text-[12px] font-semibold text-on-surface-variant">Ajustes</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline/15 p-3">
          <input type="checkbox" checked={othersCanMark} onChange={(event) => setOthersCanMark(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
          <span><span className="block text-sm font-semibold">Los demás pueden marcar tareas</span><span className="block text-[12px] text-on-surface-variant">Si lo apagas, solo tú las marcas</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline/15 p-3">
          <input type="checkbox" checked={othersCanAdd} onChange={(event) => setOthersCanAdd(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
          <span><span className="block text-sm font-semibold">Los demás pueden agregar tareas</span><span className="block text-[12px] text-on-surface-variant">Para sumar lo que falte sobre la marcha</span></span>
        </label>
        {threadOf === undefined ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline/15 p-3">
            <input type="checkbox" data-testid="checklist-fijar" checked={pin} onChange={(event) => setPin(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span><span className="block text-sm font-semibold">Fijar en el chat</span><span className="block text-[12px] text-on-surface-variant">Queda arriba de la conversación, a un clic</span></span>
          </label>
        ) : null}
      </fieldset>
    </Overlay>
  );
}

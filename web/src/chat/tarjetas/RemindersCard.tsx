import { useCallback, useEffect, useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { suscribirTarjeta, whenItRings, type AgendaReminder } from '@lilachat/shared';
import { api } from '../../api';

/**
 * The chat's reminders in its info on the web, like the app's `RecordatoriosDelGrupo` (José 27/11: a channel's
 * detail did not list the reminders added there). Everyone in the chat reads them; whoever can manage them (in a
 * group, its admins) opens one to edit it. Live: a change to one reads the list again.
 */
export function RemindersCard(props: { chatId: string; jwt: string; onEdit?: (reminder: AgendaReminder) => void }) {
  const [reminders, setReminders] = useState<AgendaReminder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    const response = await api<{ reminders: AgendaReminder[] }>(`/agenda/reminders/del-chat/${props.chatId}`, { method: 'GET', jwt: props.jwt });
    if (response.ok) {
      setReminders(response.data.reminders);
      setFailed(false);
    } else setFailed(true);
  }, [props.chatId, props.jwt]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const stops = (reminders ?? []).map((reminder) => suscribirTarjeta('recordatorio', reminder._id, () => void load()));
    return () => stops.forEach((stop) => stop());
  }, [reminders, load]);

  if (failed) return <p className="mx-4 mt-3 text-[13px] text-on-surface-variant">No se pudieron cargar los recordatorios.</p>;
  if (!reminders?.length) return null;
  return (
    <section data-testid="tarjeta-recordatorios" className="mx-4 mt-3 overflow-hidden rounded-xl bg-surface">
      <div className="h-[3px] bg-primary" />
      <div className="flex items-center gap-3 px-4 pb-3 pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Agenda</p>
          <p className="mt-0.5 text-[15px] font-bold">Recordatorios del chat</p>
        </div>
        <span className="shrink-0 rounded-md border border-outline/30 bg-background px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{reminders.length}</span>
      </div>
      {reminders.map((reminder) => (
        <ReminderRow key={reminder._id} reminder={reminder} onEdit={props.onEdit} />
      ))}
    </section>
  );
}

function ReminderRow({ reminder, onEdit }: { reminder: AgendaReminder; onEdit?: (reminder: AgendaReminder) => void }) {
  return (
    <button type="button" data-testid={`recordatorio-del-chat-${reminder._id}`} disabled={!onEdit} onClick={() => onEdit?.(reminder)} title={onEdit ? 'Editar el recordatorio' : undefined} className="flex min-h-[60px] w-full items-center gap-3 border-t border-outline/10 px-4 py-2.5 text-left hover:bg-background disabled:cursor-default disabled:hover:bg-transparent">
      {reminder.imageUrl ? (
        <img src={reminder.imageUrl} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Bell size={17} /></span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{reminder.title}</span>
        <span className="block truncate text-[12px] text-on-surface-variant">{whenItRings(reminder)}</span>
      </span>
      {onEdit ? <ChevronRight size={16} className="shrink-0 text-on-surface-variant" /> : null}
    </button>
  );
}

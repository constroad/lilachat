import { BarChart3, Bell, CalendarPlus, ChevronRight, ClipboardCheck, Paperclip, Zap, type LucideIcon } from 'lucide-react';
import type { ShortcutRow } from '@lilachat/shared';
import { AppLogo } from '../spaces/apps/AppLogo';

type Option = { key: string; label: string; hint: string; Icon: LucideIcon; testId: string; action: () => void };

/**
 * The «+» menu of the web chat (design `m-01-clip-ordenado`, desktop; José,
 * 21/10: «que no se vea todo amontonado»): labeled sections, each row an
 * icon, its name and one line saying what it does. The nudge and the winks
 * live in the emoji panel (José, 21/10), not here.
 */
export function AttachMenu(props: {
  onClose: () => void;
  onPickFile: () => void;
  onCreateEvent: () => void;
  onCreatePoll: () => void;
  onCreateChecklist?: () => void;
  onCreateReminder?: () => void;
  /** «Acciones de las apps» (R160, design e-29): the `shortcuts` of each app installed in the space. */
  actions?: readonly ShortcutRow[];
  onAction?: (row: ShortcutRow) => void;
}) {
  const sections: { title: string; options: Option[] }[] = [
    { title: 'Compartir', options: [{ key: 'file', label: 'Foto o archivo', hint: 'Fotos, videos o documentos', Icon: Paperclip, testId: 'btn-archivo-chat', action: props.onPickFile }] },
    {
      title: 'Organizar',
      options: [
        { key: 'event', label: 'Evento', hint: 'Una reunión o una visita con fecha', Icon: CalendarPlus, testId: 'btn-evento-chat', action: props.onCreateEvent },
        { key: 'poll', label: 'Encuesta', hint: 'Pregúntale al chat y vean los votos', Icon: BarChart3, testId: 'btn-encuesta-chat', action: props.onCreatePoll },
        ...(props.onCreateChecklist ? [{ key: 'checklist', label: 'Checklist', hint: 'Tareas que el chat va marcando', Icon: ClipboardCheck, testId: 'btn-checklist-chat', action: props.onCreateChecklist }] : []),
        ...(props.onCreateReminder ? [{ key: 'reminder', label: 'Recordatorio', hint: 'Un aviso que suena en este chat', Icon: Bell, testId: 'btn-recordatorio-chat', action: props.onCreateReminder }] : []),
      ],
    },
  ].filter((section) => section.options.length > 0);
  return (
    <div data-testid="menu-adjuntar" className="absolute bottom-12 left-0 z-20 w-80 rounded-xl border border-outline/15 bg-surface shadow-lg">
      <p className="border-b border-outline/15 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-primary">Adjuntar al chat</p>
      {sections.map((section, index) => (
        <div key={section.title} className={`px-2 py-2 ${index > 0 ? 'border-t border-outline/15' : ''}`}>
          <p className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">{section.title}</p>
          {section.options.map(({ key, label, hint, Icon, testId, action }) => (
            <button
              key={key}
              type="button"
              data-testid={testId}
              onClick={() => {
                props.onClose();
                action();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-background"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-outline/15 bg-primary/10 text-primary">
                <Icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-on-surface">{label}</span>
                <span className="block truncate text-[12px] text-on-surface-variant">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
      {props.actions?.length && props.onAction ? (
        <div data-testid="acciones-de-apps" className="max-h-64 overflow-y-auto border-t border-outline/15 px-2 py-2">
          <p className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant"><Zap size={13} className="text-warning" fill="currentColor" /> Acciones de las apps</p>
          {props.actions.map((row) => (
            <button key={`${row.appId}:${row.key}`} type="button" data-testid={`accion-${row.key}`} onClick={() => { props.onClose(); props.onAction!(row); }} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-background">
              <AppLogo avatarUrl={row.avatarUrl} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-on-surface">{row.name}</span>
                <span className="block truncate text-[12px] text-on-surface-variant">{row.appName}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-on-surface-variant" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

import { AtSign, Bell, BellOff, type LucideIcon } from 'lucide-react';
import { NOTIFICATION_LEVEL_TEXT, NOTIFICATION_LEVELS, type NotificationLevel } from '@lilachat/shared';
import { Overlay } from '../../ui/Overlay';

/** One icon per level, as in the design (`e-18`). */
const LEVEL_ICON: Record<NotificationLevel, LucideIcon> = { todo: Bell, menciones: AtSign, nada: BellOff };

/** «Avisos de este grupo» (E3b, 20/10), like Slack: everything, only mentions or nothing. Choosing applies it. */
export function NotificationLevelDialog(props: { level: NotificationLevel; onChoose: (level: NotificationLevel) => void; onClose: () => void }) {
  return (
    <Overlay title="Avisos de este grupo" onClose={props.onClose}>
      <p className="text-sm text-on-surface-variant">Las llamadas siempre suenan.</p>
      <div role="radiogroup" className="mt-3 flex flex-col gap-2">
        {NOTIFICATION_LEVELS.map((level) => {
          const active = level === props.level;
          const Icon = LEVEL_ICON[level];
          return (
          <label key={level} className={`flex min-h-[60px] cursor-pointer items-center gap-3 rounded-xl border px-3 ${active ? 'border-2 border-primary bg-primary/5' : 'border-outline/20 hover:bg-background'}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background">
              <Icon size={18} className={active ? 'text-primary' : 'text-on-surface-variant'} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`flex items-center gap-2 text-sm ${active ? 'font-semibold text-primary' : ''}`}>
                {NOTIFICATION_LEVEL_TEXT[level].title}
                {active ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-on-primary">Activo</span> : null}
              </span>
              <span className="block text-[12px] text-on-surface-variant">{NOTIFICATION_LEVEL_TEXT[level].detail}</span>
            </span>
            <input type="radio" name="avisos" data-testid={`avisos-${level}`} checked={active} onChange={() => props.onChoose(level)} className="h-4 w-4 accent-primary" />
          </label>
          );
        })}
      </div>
    </Overlay>
  );
}

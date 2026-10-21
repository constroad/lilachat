import { NOTIFICATION_LEVEL_TEXT, NOTIFICATION_LEVELS, type NotificationLevel } from '@lilachat/shared';
import { Overlay } from '../../ui/Overlay';

/** «Avisos de este grupo» (E3b, 20/10), like Slack: everything, only mentions or nothing. Choosing applies it. */
export function NotificationLevelDialog(props: { level: NotificationLevel; onChoose: (level: NotificationLevel) => void; onClose: () => void }) {
  return (
    <Overlay title="Avisos de este grupo" onClose={props.onClose}>
      <p className="text-sm text-on-surface-variant">Las llamadas siempre suenan.</p>
      <div role="radiogroup" className="mt-3">
        {NOTIFICATION_LEVELS.map((level) => (
          <label key={level} className={`-mx-4 flex min-h-[56px] cursor-pointer items-center justify-between gap-4 px-4 ${level === props.level ? 'bg-primary/5' : ''}`}>
            <span className="min-w-0">
              <span className="block text-sm">{NOTIFICATION_LEVEL_TEXT[level].title}</span>
              <span className="block text-[12px] text-on-surface-variant">{NOTIFICATION_LEVEL_TEXT[level].detail}</span>
            </span>
            <input type="radio" name="avisos" data-testid={`avisos-${level}`} checked={level === props.level} onChange={() => props.onChoose(level)} className="h-4 w-4 accent-primary" />
          </label>
        ))}
      </div>
    </Overlay>
  );
}

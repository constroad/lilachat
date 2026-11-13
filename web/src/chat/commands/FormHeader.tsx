import type { CardContext } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { AppLogo } from '../../spaces/apps/AppLogo';
import { TONE as PILL_TONE } from '../BotCardView';

/** The app's tile, its name over the title, and where it is and who registers (design gst-02). */
export function FormHeader(props: { title: string; appName: string; avatarUrl?: string; /** «#flujo-caja»: the channel it was opened in. */ where?: string; personName?: string }) {
  const subtitle = [props.where ? `Canal ${props.where}` : '', props.personName ? `Registra: ${props.personName}` : ''].filter(Boolean).join(' · ');
  return (
    <div data-testid="formulario-cabecera" className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-primary/25 bg-primary/10">
        {props.avatarUrl ? <AppLogo avatarUrl={props.avatarUrl} size={36} rounded="rounded-xl" /> : <Avatar name={props.appName} size={36} bot />}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-[10px] font-bold uppercase tracking-wider text-primary">{props.appName}</span>
          <span className="rounded border border-outline/30 px-1 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">App</span>
        </p>
        <h2 className="line-clamp-2 text-base font-extrabold leading-tight tracking-tight">{props.title}</h2>
        {subtitle ? <p className="mt-0.5 truncate text-[11px] font-medium text-on-surface-variant">{subtitle}</p> : null}
      </div>
    </div>
  );
}

/** What the card said, above the fields (design gst-02): the figure, the shop, the state and what was read. */
export function FormContextCard({ context }: { context: CardContext }) {
  return (
    <div data-testid="formulario-contexto" className="rounded-xl border border-outline/20 bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{context.kicker ?? ''}</p>
        {context.status ? <span className={`shrink-0 rounded border px-1.5 text-[9px] font-bold uppercase tracking-wider ${PILL_TONE[context.status.tone]}`}>{context.status.label}</span> : null}
      </div>
      {context.figure ? <p className="mt-0.5 text-xl font-extrabold tabular-nums tracking-tight">{context.figure}</p> : null}
      <p className={`mt-0.5 break-words font-bold ${context.figure ? 'text-xs' : 'text-base'}`}>{context.title}</p>
      {context.fields.length ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-outline/15 pt-2">
          {context.fields.map((field) => (
            <div key={`${field.label}-${field.value}`} className="min-w-0">
              <dt className="text-[10px] text-on-surface-variant">{field.label}</dt>
              <dd className="break-words text-[12px] font-semibold">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

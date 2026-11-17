import { Clock } from 'lucide-react';
import { inboxSectionOf, overdueOf, prospectNameOf, overdueLabelOf, prospectTimeOf, type ProspectView } from '@lilachat/shared';
import { Initials, OriginPill, Pill, ProspectAvatar, ScorePill, StagePill } from './daliParts';

/**
 * A prospect in the inbox (dl-01 v3): name and when, the service, what Dali understood, what is late, and the pills
 * (origin, score, stage) with who attends it. The company line Stitch drew has no field yet: the service goes there.
 * On a phone the initials go beside the name, as in the mobile design; below it every line takes the card's whole width.
 */
export function ProspectRow(props: { prospect: ProspectView; unread?: number; selected: boolean; phone?: boolean; now: Date; onOpen: () => void }) {
  const { prospect, now } = props;
  const name = prospectNameOf(prospect);
  const overdue = overdueOf(prospect, now);
  const unread = props.unread ?? 0;
  return (
    <button
      type="button"
      data-testid={`fila-prospecto-${prospect.id}`}
      aria-current={props.selected}
      onClick={props.onOpen}
      className={`w-full rounded-xl border bg-surface px-4 py-3 text-left transition-colors ${props.selected ? 'border-primary/40 bg-primary/5 shadow-[inset_3px_0_0_rgb(var(--c-primary))]' : 'border-outline/15 hover:border-outline/30'}`}
    >
      <div className="flex items-center gap-2.5">
        {props.phone ? <ProspectAvatar name={name} size="sm" /> : null}
        <span className={`min-w-0 flex-1 truncate text-[15px] ${unread > 0 ? 'font-extrabold' : 'font-bold'}`}>{name}</span>
        <span className={`shrink-0 text-[12px] ${unread > 0 || props.selected ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{prospectTimeOf(prospect.lastActivityAt, now)}</span>
        {unread > 0 ? <span data-testid="sin-leer-prospecto" className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-on-primary">{unread}</span> : null}
      </div>
      {prospect.service ? <p className="mt-0.5 truncate text-[13px] text-on-surface-variant">{prospect.service.name}</p> : null}
      {prospect.summary ? <p className="mt-1 line-clamp-2 text-[14px] leading-5">{prospect.summary}</p> : null}
      {overdue ? (
        <p data-testid="vencido-prospecto" className="mt-1 flex items-center gap-1 text-[13px] font-medium text-warning">
          <Clock size={14} className="shrink-0" />
          <span className="truncate">{overdueLabelOf(overdue, now)}</span>
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        {/* The pills give way (Stitch dl-01 note: they never wrap); who attends never does. */}
        <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <OriginPill prospect={prospect} shrink="first" />
          <ScorePill score={prospect.score} />
          <StagePill prospect={prospect} />
        </span>
        <WhoAttends prospect={prospect} now={now} />
      </div>
    </button>
  );
}

/** The seller's initials; «Sin asignar» when nobody took one that needs it now; «Dali» while Dali converses alone. */
function WhoAttends({ prospect, now }: { prospect: ProspectView; now: Date }) {
  if (prospect.assignee) return <Initials name={prospect.assignee.name} />;
  if (inboxSectionOf(prospect, now) === 'now') return <Pill tone="warn">Sin asignar</Pill>;
  return prospect.attendedBy === 'dali' ? <Pill tone="primary">Dali</Pill> : null;
}

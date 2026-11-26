import { inboxSectionOf, prospectNameOf, prospectTimeOf, type ProspectLevel, type ProspectView } from '@lilachat/shared';
import { Initials, Pill, ProspectAvatar } from './daliParts';
import { rowAskLineOf, rowScoreOf, rowStatusOf } from './prospectRowStatus';

const LEVEL_DOT: Record<ProspectLevel, string> = { hot: 'bg-error', warm: 'bg-warning', cold: 'bg-secondary' };

/**
 * A prospect in the inbox (dl-01 v4, José 26/11: «todo muy desordenado… no deja llevar un buen control»): three lines of
 * fixed height that never break mid-word — name, when and unread; the service and what was asked on one line; and ONE
 * pill that says what to do (late, what is missing, or the stage), the score with its dot and who attends. The origin
 * went to the ficha. On a phone the initials go beside the name.
 */
export function ProspectRow(props: { prospect: ProspectView; unread?: number; selected: boolean; phone?: boolean; now: Date; onOpen: () => void }) {
  const { prospect, now } = props;
  const name = prospectNameOf(prospect);
  const unread = props.unread ?? 0;
  const status = rowStatusOf(prospect, now);
  const ask = rowAskLineOf(prospect);
  const score = rowScoreOf(prospect.score);
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
      <p data-testid="pedido-prospecto" className="mt-0.5 h-5 truncate text-[13px] text-on-surface-variant">{ask ?? ''}</p>
      <div className="mt-2 flex items-center gap-2">
        <span data-testid="estado-prospecto" title={status.full ?? status.text} className="flex min-w-0 flex-1"><Pill shrink tone={status.tone}>{status.text}</Pill></span>
        {score ? (
          <span data-testid="puntaje-prospecto" aria-label={`${score.score} puntos`} className="flex shrink-0 items-center gap-1 text-[13px] font-bold tabular-nums">
            <span className={`h-2 w-2 rounded-full ${LEVEL_DOT[score.level]}`} />{score.score}
          </span>
        ) : null}
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

import type { ReactNode } from 'react';
import { Check, ChevronDown, Phone } from 'lucide-react';
import { LEVEL_LABEL, LOSS_REASON_LABEL, NEXT_ACTION_LABEL, STAGE_LABEL, levelOf, missingLabelsOf, moneyOf, nextActionWhenOf, originLineOf, originOf, prospectNameOf, shownProspectPhone, shownStageOf, type ProspectStage, type ProspectView } from '@lilachat/shared';
import { Initials, Kicker, OriginPill, Pill, ProspectAvatar, ScorePill, StagePill } from './daliParts';
import { DocumentFieldRow, type SettleField } from './DocumentFieldRow';

/** The blocks of the ficha (dl-03), each one a card; the ficha decides the order and the actions around them. */

const LIMA = 'America/Lima';
const ARRIVAL = new Intl.DateTimeFormat('es-PE', { timeZone: LIMA, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
const DAY = new Intl.DateTimeFormat('es-PE', { timeZone: LIMA, day: 'numeric', month: 'long' });
/** The stages a sale walks; lost is said apart, with its reason. */
const WALK: readonly ProspectStage[] = ['missing_info', 'to_quote', 'visit', 'quoted', 'negotiation', 'won'];

export function Card({ children, testId, accent }: { children: ReactNode; testId?: string; accent?: boolean }) {
  return <section data-testid={testId} className={`rounded-xl border border-outline/15 bg-surface px-4 py-3.5 ${accent ? 'shadow-[inset_0_3px_0_rgb(var(--c-primary))]' : ''}`}>{children}</section>;
}

/**
 * The ficha's head (dl-01 v4): who, the number and three pills — score, stage, origin. «Llamar» only where no
 * conversation header is beside it (opened from the funnel, the panel or the review): one call button on screen.
 */
export function ProfileCard({ prospect, withCall }: { prospect: ProspectView; withCall?: boolean }) {
  const name = prospectNameOf(prospect);
  return (
    <Card testId="ficha-contacto">
      <div className="flex items-center gap-3">
        <ProspectAvatar name={name} size="lg" />
        <span className="min-w-0">
          <span className="block truncate text-base font-extrabold">{name}</span>
          <span className="block whitespace-nowrap font-mono text-[13px] text-on-surface-variant">{shownProspectPhone(prospect.phone)}</span>
        </span>
      </div>
      <div data-testid="ficha-pastillas" className="mt-2.5 flex flex-wrap gap-1.5"><ScorePill score={prospect.score} /><StagePill prospect={prospect} /><OriginPill prospect={prospect} /></div>
      {withCall && prospect.phone ? (
        <a href={`tel:+${prospect.phone}`} data-testid="llamar-prospecto" className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-[13px] font-semibold text-on-primary">
          <Phone size={16} /> Llamar
        </a>
      ) : null}
    </Card>
  );
}

/** A card folded to one line with its chevron: what is read only when asked for (the score's reasons, the origin). */
function Folded({ testId, title, children }: { testId: string; title: string; children: ReactNode }) {
  return (
    <details data-testid={testId} className="group rounded-xl border border-outline/15 bg-surface">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 text-[12px] font-bold uppercase tracking-wide text-on-surface-variant [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-3.5">{children}</div>
    </details>
  );
}

export function OriginCard({ prospect }: { prospect: ProspectView }) {
  const arrived = prospect.firstContactAt ?? prospect.createdAt;
  return (
    <Folded testId="ficha-origen" title={`Origen · ${originOf(prospect).label}`}>
      <p className="text-sm font-semibold [overflow-wrap:anywhere]">{originLineOf(prospect)}</p>
      <p className="text-[13px] text-on-surface-variant">{`Llegó el ${ARRIVAL.format(new Date(arrived))}`}</p>
    </Folded>
  );
}

/** «Por qué es caliente · 4 razones»: the score's reasons, folded; the score itself is a pill of the head. */
export function ScoreCard({ prospect }: { prospect: ProspectView }) {
  const level = levelOf(prospect.score);
  const reasons = prospect.scoreReasons ?? [];
  if (prospect.score === undefined || !level || !reasons.length) return null;
  return (
    <Folded testId="ficha-calificacion" title={`Por qué es ${LEVEL_LABEL[level].toLowerCase()} · ${reasons.length} ${reasons.length === 1 ? 'razón' : 'razones'}`}>
      <ul className="flex flex-wrap gap-1.5">
        {reasons.map((reason) => (
          <li key={reason} className="flex items-center gap-1.5 rounded-lg border border-outline/15 px-2.5 py-1 text-[13px]"><Check size={14} className="shrink-0 text-en-linea" />{reason}</li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-on-surface-variant">Puntaje por reglas con lo que entendió Dali</p>
    </Folded>
  );
}

export function UnderstoodCard({ prospect, onSettle }: { prospect: ProspectView; onSettle?: SettleField }) {
  const missing = missingLabelsOf(prospect);
  if (!prospect.fields?.length && !missing.length && !prospect.summary) return null;
  return (
    <Card testId="ficha-entendio">
      <Kicker>Lo que entendió Dali</Kicker>
      {prospect.summary ? <p className="mt-2 text-sm">{prospect.summary}</p> : null}
      {prospect.fields?.length ? (
        <dl className="mt-2 divide-y divide-outline/10">
          {prospect.fields.map((field) => <DocumentFieldRow key={field.key} field={field} onSettle={onSettle} />)}
        </dl>
      ) : null}
      {missing.length ? <p data-testid="ficha-falta" className="mt-2 text-[13px] font-medium text-warning">{`Falta: ${missing.join(', ')}`}</p> : null}
    </Card>
  );
}

export function QuoteCard({ prospect }: { prospect: ProspectView }) {
  const quote = prospect.quote;
  if (!quote) return null;
  return (
    <Card testId="ficha-cotizacion">
      <Kicker>Cotización</Kicker>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-sm font-semibold">{quote.code}</span>
        {quote.amount !== undefined ? <span data-testid="monto-cotizacion" className="ml-auto text-lg font-extrabold tabular-nums text-primary">{quote.currency && quote.currency !== 'PEN' ? `${quote.currency} ${quote.amount.toFixed(2)}` : moneyOf(quote.amount)}</span> : null}
      </div>
      {quote.sentAt ? <p className="text-[13px] text-on-surface-variant">{`Enviada el ${DAY.format(new Date(quote.sentAt))}`}</p> : null}
      {quote.url ? <a href={quote.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[13px] font-semibold text-primary">Ver cotización</a> : null}
    </Card>
  );
}

/** The funnel's stages in one row (dl-01 v4): done ones checked, the current one named; lost says so with its reason. */
export function StageCard({ prospect }: { prospect: ProspectView }) {
  const stage = shownStageOf(prospect);
  const current = WALK.indexOf(stage);
  return (
    <Card testId="ficha-etapa">
      <div className="flex items-center justify-between gap-2">
        <Kicker>Etapa</Kicker>
        {stage === 'lost' ? null : <Pill tone="primary" testId="etapa-actual">{STAGE_LABEL[stage]}</Pill>}
      </div>
      {stage === 'lost' ? <p className="mt-2 text-sm font-semibold text-error">{`Perdido${prospect.result?.reason ? ` · ${LOSS_REASON_LABEL[prospect.result.reason]}` : ''}`}</p> : (
        <ol aria-label={`Etapa: ${STAGE_LABEL[stage]}`} className="mt-3 flex items-center">
          {WALK.map((one, index) => (
            <li key={one} title={STAGE_LABEL[one]} className="flex flex-1 items-center last:flex-none">
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${index < current ? 'bg-primary text-on-primary' : index === current ? 'bg-primary ring-4 ring-primary/20' : 'border-2 border-outline/30 bg-surface'}`}>
                {index < current ? <Check size={12} /> : null}
              </span>
              {index < WALK.length - 1 ? <span className={`h-0.5 flex-1 ${index < current ? 'bg-primary' : 'bg-outline/20'}`} /> : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** The next action on top of the ficha (dl-01 v4): «Cambiar» and «Hecho» (it clears it); without one, «Agendar». */
export function NextActionCard({ prospect, now, onPlan, onDone }: { prospect: ProspectView; now: Date; onPlan?: () => void; onDone?: () => void }) {
  const action = prospect.nextAction;
  return (
    <Card testId="ficha-proxima" accent={Boolean(action)}>
      <Kicker className={action ? 'text-primary' : ''}>Próxima acción</Kicker>
      {action ? (
        <div className="mt-2">
          <p className="text-sm font-bold">{`${NEXT_ACTION_LABEL[action.kind]} · ${nextActionWhenOf(action.at, now)}`}</p>
          {action.note ? <p className="text-[13px] text-on-surface-variant">{action.note}</p> : null}
        </div>
      ) : <p className="mt-2 text-sm text-on-surface-variant">Sin próxima acción.</p>}
      {onPlan ? (
        <div className="mt-3 flex gap-2">
          <button type="button" data-testid="agendar-proxima" onClick={onPlan} className={`h-9 flex-1 rounded-lg border px-3 text-[13px] font-semibold hover:bg-primary/5 ${action ? 'border-outline/30' : 'border-dashed border-primary/40 text-primary'}`}>{action ? 'Cambiar' : 'Agendar próxima acción'}</button>
          {action && onDone ? <button type="button" data-testid="proxima-hecha" onClick={onDone} className="h-9 flex-1 rounded-lg bg-primary px-3 text-[13px] font-semibold text-on-primary">Hecho</button> : null}
        </div>
      ) : null}
    </Card>
  );
}

export function AttendsLine({ prospect }: { prospect: ProspectView }) {
  if (!prospect.assignee) return <p className="text-sm text-on-surface-variant">{prospect.attendedBy === 'dali' ? 'Nadie lo tomó: Dali conversa.' : 'Nadie lo tomó todavía.'}</p>;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Initials name={prospect.assignee.name} size={36} />
      <span className="min-w-0 truncate text-sm font-bold">{prospect.assignee.name}</span>
    </span>
  );
}

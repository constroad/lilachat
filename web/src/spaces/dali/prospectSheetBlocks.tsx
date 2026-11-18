import type { ReactNode } from 'react';
import { Check, Phone } from 'lucide-react';
import { LEVEL_LABEL, LOSS_REASON_LABEL, NEXT_ACTION_LABEL, STAGE_LABEL, levelOf, missingLabelsOf, moneyOf, nextActionWhenOf, originOf, prospectNameOf, shownProspectPhone, shownStageOf, type ProspectStage, type ProspectView } from '@lilachat/shared';
import { Initials, Kicker, Pill, ProspectAvatar, ScorePill } from './daliParts';

/** The blocks of the ficha (dl-03), each one a card; the ficha decides the order and the actions around them. */

const LIMA = 'America/Lima';
const ARRIVAL = new Intl.DateTimeFormat('es-PE', { timeZone: LIMA, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
const DAY = new Intl.DateTimeFormat('es-PE', { timeZone: LIMA, day: 'numeric', month: 'long' });
/** The stages a sale walks; lost is said apart, with its reason. */
const WALK: readonly ProspectStage[] = ['missing_info', 'to_quote', 'visit', 'quoted', 'negotiation', 'won'];

export function Card({ children, testId, accent }: { children: ReactNode; testId?: string; accent?: boolean }) {
  return <section data-testid={testId} className={`rounded-xl border border-outline/15 bg-surface px-4 py-3.5 ${accent ? 'shadow-[inset_0_3px_0_rgb(var(--c-primary))]' : ''}`}>{children}</section>;
}

export function ContactCard({ prospect }: { prospect: ProspectView }) {
  const name = prospectNameOf(prospect);
  return (
    <Card testId="ficha-contacto">
      <Kicker>Datos de contacto</Kicker>
      <div className="mt-2 flex items-center gap-3">
        <ProspectAvatar name={name} size="xl" />
        <span className="min-w-0">
          <span className="block truncate text-base font-extrabold">{name}</span>
          <span className="block whitespace-nowrap font-mono text-[13px] text-on-surface-variant">{shownProspectPhone(prospect.phone)}</span>
        </span>
      </div>
      <a href={`tel:+${prospect.phone}`} data-testid="llamar-prospecto" className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-[13px] font-semibold text-on-primary">
        <Phone size={16} /> Llamar
      </a>
    </Card>
  );
}

export function OriginCard({ prospect }: { prospect: ProspectView }) {
  const arrived = prospect.firstContactAt ?? prospect.createdAt;
  return (
    <Card testId="ficha-origen">
      <Kicker>Origen</Kicker>
      <div className="mt-2"><Pill>{originOf(prospect).label}</Pill></div>
      {prospect.source?.adTitle ? <p className="mt-2 text-sm font-semibold">{`Anuncio · ${prospect.source.adTitle}`}</p> : <p className="mt-2 text-sm font-semibold">Escribió directo por WhatsApp</p>}
      <p className="text-[13px] text-on-surface-variant">{`Llegó el ${ARRIVAL.format(new Date(arrived))}`}</p>
    </Card>
  );
}

export function ScoreCard({ prospect }: { prospect: ProspectView }) {
  const level = levelOf(prospect.score);
  if (prospect.score === undefined || !level) return null;
  return (
    <Card testId="ficha-calificacion">
      <div className="flex items-center justify-between"><Kicker>Calificación Dali</Kicker><ScorePill score={prospect.score} /></div>
      <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight text-primary" aria-label={`${prospect.score} puntos, ${LEVEL_LABEL[level]}`}>{prospect.score}</p>
      {prospect.scoreReasons?.length ? (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {prospect.scoreReasons.map((reason) => (
            <li key={reason} className="flex items-center gap-2 rounded-lg border border-outline/15 px-2.5 py-1.5 text-[13px]"><Check size={14} className="shrink-0 text-en-linea" />{reason}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[12px] text-on-surface-variant">Puntaje por reglas con lo que entendió Dali</p>
    </Card>
  );
}

export function UnderstoodCard({ prospect }: { prospect: ProspectView }) {
  const missing = missingLabelsOf(prospect);
  if (!prospect.fields?.length && !missing.length && !prospect.summary) return null;
  return (
    <Card testId="ficha-entendio">
      <Kicker>Lo que entendió Dali</Kicker>
      {prospect.summary ? <p className="mt-2 text-sm">{prospect.summary}</p> : null}
      {prospect.fields?.length ? (
        <dl className="mt-2 divide-y divide-outline/10">
          {prospect.fields.map((field) => (
            <div key={field.key} className="flex gap-3 py-1.5 text-[13px]">
              <dt className="w-28 shrink-0 text-on-surface-variant">{field.label}</dt>
              <dd className="min-w-0 flex-1 text-right font-semibold">
                {field.value}
                {field.source === 'document' && !field.confirmed ? <span className="mt-1 flex justify-end"><Pill tone="warn" testId={`por-confirmar-${field.key}`}>Leído del documento · por confirmar</Pill></span> : null}
              </dd>
            </div>
          ))}
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

/** The funnel's stages, the current one marked; a lost prospect says so with its reason. */
export function StageCard({ prospect }: { prospect: ProspectView }) {
  const stage = shownStageOf(prospect);
  const current = WALK.indexOf(stage);
  return (
    <Card testId="ficha-etapa">
      <Kicker>Etapa del prospecto</Kicker>
      {stage === 'lost' ? <p className="mt-2 text-sm font-semibold text-error">{`Perdido${prospect.result?.reason ? ` · ${LOSS_REASON_LABEL[prospect.result.reason]}` : ''}`}</p> : (
        <ol className="mt-2 space-y-1">
          {WALK.map((one, index) => (
            <li key={one} data-testid={index === current ? 'etapa-actual' : undefined} className={`flex h-9 items-center gap-2.5 rounded-lg px-2 text-[14px] ${index === current ? 'border border-primary/30 bg-primary/5 font-bold text-primary' : index < current ? '' : 'text-on-surface-variant'}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${index < current ? 'bg-en-linea/15 text-en-linea' : index === current ? 'bg-primary text-on-primary' : 'bg-surface-variant/60'}`}>{index < current ? <Check size={12} /> : index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{STAGE_LABEL[one]}</span>
              {index === current ? <Pill tone="primary">Actual</Pill> : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function NextActionCard({ prospect, now, onPlan }: { prospect: ProspectView; now: Date; onPlan?: () => void }) {
  const action = prospect.nextAction;
  return (
    <Card testId="ficha-proxima" accent={Boolean(action)}>
      <Kicker>Próxima acción</Kicker>
      {action ? (
        <div className="mt-2">
          <p className="text-sm font-bold">{`${NEXT_ACTION_LABEL[action.kind]} · ${nextActionWhenOf(action.at, now)}`}</p>
          {action.note ? <p className="text-[13px] text-on-surface-variant">{action.note}</p> : null}
        </div>
      ) : <p className="mt-2 text-sm text-on-surface-variant">Sin próxima acción.</p>}
      {onPlan ? <button type="button" data-testid="agendar-proxima" onClick={onPlan} className="mt-2 h-9 rounded-lg border border-dashed border-primary/40 px-3 text-[13px] font-semibold text-primary hover:bg-primary/5">{action ? 'Cambiar' : 'Agendar'}</button> : null}
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

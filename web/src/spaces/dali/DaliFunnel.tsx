import { useMemo, useState, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { NEXT_ACTION_LABEL, funnelOf, inboxOf, lacksNextAction, missingLabelsOf, moneyOf, nextActionWhenOf, overdueLabelOf, overdueOf, periodStartOf, prospectNameOf, type ProspectStage, type ProspectView } from '@lilachat/shared';
import { EmptyNote, Initials, Kicker, OriginPill, Pill, ProspectAvatar, ScorePill, Segmented, SkeletonRows } from './daliParts';
import type { ProspectList } from './prospectsApi';

type Period = 'week' | 'month';
type Props = { list: ProspectList | null; now: Date; service?: string; onService: (key: string | undefined) => void; onOpenProspect: (prospect: ProspectView) => void; phone?: boolean };
const COLUMN_TONE: Partial<Record<ProspectStage, string>> = { to_quote: 'text-warning', won: 'text-en-linea', lost: 'text-error' };

/**
 * The funnel (dl-08 v3, v5 on a phone): where each prospect goes, with the four figures that need someone (missing
 * information, to quote, quotes without an answer, no next action) and the board by stage. Filtered by service (José
 * 16/11). The hours of the next actions come from each prospect; Stitch's strip labels and «EN LÍNEA» do not go.
 */
export function DaliFunnel(props: Props) {
  const { list, now } = props;
  const [period, setPeriod] = useState<Period>('week');
  const funnel = useMemo(() => funnelOf(list?.prospects ?? [], { since: periodStartOf(period, now), service: props.service }, now), [list, period, props.service, now]);
  const services = useMemo(() => inboxOf(list?.prospects ?? [], { me: '', view: 'all' }, now).services, [list, now]);
  if (!list) return <div className="p-4"><SkeletonRows /></div>;
  return (
    <div data-testid="embudo-dali" className="space-y-4 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">En qué va cada prospecto</h2>
        <span className="text-[13px] text-on-surface-variant">{`${funnel.newSince} ${funnel.newSince === 1 ? 'nuevo' : 'nuevos'} ${period === 'week' ? 'en los últimos 7 días' : 'este mes'} · ${funnel.open} abiertos`}</span>
        <span className="min-w-0 flex-1" />
        <div className="w-full sm:w-64"><Segmented testId="periodo-embudo" value={period} onChange={setPeriod} segments={[{ key: 'week', label: 'Últimos 7 días' }, { key: 'month', label: 'Este mes' }]} /></div>
      </div>
      {services.length > 1 || props.service ? (
        <select data-testid="filtro-servicio-embudo" value={props.service ?? ''} onChange={(event) => props.onService(event.target.value || undefined)} className="h-9 rounded-lg border border-outline/30 bg-surface px-2 text-[13px]">
          <option value="">Todos los servicios</option>
          {services.map((service) => <option key={service.key} value={service.key}>{`${service.name} · ${service.count}`}</option>)}
        </select>
      ) : null}
      <Figures figures={funnel.figures} now={now} />
      {funnel.open === 0 && funnel.columns.every((column) => column.items.length === 0) ? <EmptyNote title="Todavía no hay prospectos en este periodo." /> : props.phone ? <PhoneBoard {...props} columns={funnel.columns} /> : <Board {...props} columns={funnel.columns} />}
    </div>
  );
}

const HOUR_MS = 3_600_000;
/** Under two days in hours («27 h»), then in days («4 días»), the way the design says it. */
function agoOf(since: string, now: Date): string {
  const hours = Math.max(1, Math.round((now.getTime() - Date.parse(since)) / HOUR_MS));
  return hours < 48 ? `${hours} h` : `${Math.floor(hours / 24)} días`;
}

function Figures({ figures, now }: { figures: ReturnType<typeof funnelOf>['figures']; now: Date }) {
  const lateLine = (late: { name: string; since: string }[], what: string) => (late.length ? `${late.length} ${what} hace ${agoOf(late[0]!.since, now)} (${late.map((one) => one.name).join(', ')})` : '');
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-outline/15 bg-surface lg:grid-cols-4 lg:divide-x lg:divide-outline/15">
      <Figure testId="cifra-falta" value={figures.missingInfo} title="Falta información" hint="Dali las está preguntando" />
      <Figure testId="cifra-por-cotizar" value={figures.toQuote.count} title="Por cotizar" alert={lateLine(figures.toQuote.late, figures.toQuote.late.length === 1 ? 'vencido' : 'vencidos')} />
      <Figure testId="cifra-sin-respuesta" value={figures.quoteUnanswered.count} title="Cotización sin respuesta" alert={lateLine(figures.quoteUnanswered.late, figures.quoteUnanswered.late.length === 1 ? 'vencida' : 'vencidas')} />
      <Figure testId="cifra-sin-proxima" value={figures.withoutNextAction.length} title="Sin próxima acción" hint={figures.withoutNextAction.slice(0, 3).join(', ')} danger={figures.withoutNextAction.length > 0} />
    </div>
  );
}

function Figure({ value, title, hint, alert, danger, testId }: { value: number; title: string; hint?: string; alert?: string; danger?: boolean; testId: string }) {
  return (
    <div data-testid={testId} className={`border-b border-outline/15 px-4 py-3 lg:border-b-0 ${danger ? 'bg-error/5' : ''}`}>
      <p className={`text-3xl font-extrabold tabular-nums ${danger ? 'text-error' : ''}`}>{value}</p>
      <p className={`text-sm font-bold ${danger ? 'text-error' : ''}`}>{title}</p>
      {alert ? <p className="mt-0.5 flex items-start gap-1 text-[12px] font-medium text-error"><CircleAlert size={13} className="mt-px shrink-0" />{alert}</p> : hint ? <p className="mt-0.5 line-clamp-2 text-[12px] text-on-surface-variant">{hint}</p> : null}
    </div>
  );
}

type Column = ReturnType<typeof funnelOf>['columns'][number];

function Board(props: Props & { columns: Column[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {props.columns.map((column) => (
        <section key={column.stage} data-testid={`columna-${column.stage}`} className="w-[272px] shrink-0">
          <div className="mb-2 flex items-center justify-between border-b border-outline/15 pb-2">
            <Kicker className={COLUMN_TONE[column.stage] ?? ''}>{column.label}</Kicker>
            <span className="grid h-6 min-w-[24px] place-items-center rounded-full bg-surface-variant/60 px-1.5 text-[12px] font-bold">{column.items.length}</span>
          </div>
          <div className="space-y-2.5">{column.items.map((prospect) => <FunnelCard key={prospect.id} prospect={prospect} now={props.now} onOpen={() => props.onOpenProspect(prospect)} />)}</div>
        </section>
      ))}
    </div>
  );
}

/** On a phone (dl-08 v5): a tile per stage, and the chosen stage's prospects under it. */
function PhoneBoard(props: Props & { columns: Column[] }) {
  const [stage, setStage] = useState<ProspectStage>(() => props.columns.find((column) => column.items.length)?.stage ?? 'missing_info');
  const chosen = props.columns.find((column) => column.stage === stage);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {props.columns.map((column) => (
          <button key={column.stage} type="button" data-testid={`baldosa-${column.stage}`} aria-pressed={column.stage === stage} onClick={() => setStage(column.stage)} className={`rounded-xl border px-3 py-2 text-left ${column.stage === stage ? 'border-primary bg-primary/5' : 'border-outline/15 bg-surface'}`}>
            <span className="block text-2xl font-extrabold tabular-nums">{column.items.length}</span>
            <span className={`block truncate text-[13px] font-semibold ${COLUMN_TONE[column.stage] ?? ''}`}>{column.label}</span>
          </button>
        ))}
      </div>
      {chosen ? (
        <section className="space-y-2.5">
          <Kicker>{`${chosen.label} · ${chosen.items.length}`}</Kicker>
          {chosen.items.map((prospect) => <FunnelCard key={prospect.id} prospect={prospect} now={props.now} onOpen={() => props.onOpenProspect(prospect)} />)}
        </section>
      ) : null}
    </>
  );
}

function FunnelCard({ prospect, now, onOpen }: { prospect: ProspectView; now: Date; onOpen: () => void }) {
  const name = prospectNameOf(prospect);
  const overdue = overdueOf(prospect, now);
  const missing = missingLabelsOf(prospect);
  return (
    <button type="button" data-testid={`tarjeta-${prospect.id}`} onClick={onOpen} className={`w-full space-y-2 rounded-xl border bg-surface px-3 py-3 text-left hover:border-outline/40 ${overdue ? 'border-error/30' : 'border-outline/15'}`}>
      <span className="flex items-start gap-2.5">
        <ProspectAvatar name={name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">{name}</span>
          {prospect.service ? <span className="block truncate text-[12px] text-on-surface-variant">{prospect.service.name}</span> : null}
        </span>
        <OriginPill prospect={prospect} />
      </span>
      <span className="flex flex-wrap items-center gap-1.5"><ScorePill score={prospect.score} />{prospect.attendedBy === 'dali' && !prospect.assignee ? <Pill tone="primary">Dali</Pill> : null}</span>
      {missing.length && !prospect.result ? <Note tone="warn">{`Falta: ${missing.join(' · ')}`}</Note> : null}
      {overdue ? <Note tone="error">{overdueLabelOf(overdue, now)}</Note> : null}
      {prospect.quote ? <span className="flex items-baseline justify-between gap-2 font-mono text-[12px]"><span className="truncate">{prospect.quote.code}</span>{prospect.quote.amount !== undefined ? <span className="shrink-0 font-semibold">{moneyOf(prospect.quote.amount)}</span> : null}</span> : null}
      {lacksNextAction(prospect) ? <Note tone="dashed">Sin próxima acción · Agendar</Note> : null}
      <Foot prospect={prospect} now={now} />
    </button>
  );
}

function Note({ tone, children }: { tone: 'warn' | 'error' | 'dashed'; children: ReactNode }) {
  const style = { warn: 'border-warning/30 bg-warning/10 text-warning', error: 'border-error/30 bg-error/5 text-error', dashed: 'border-dashed border-error/40 text-error' }[tone];
  return <span className={`block rounded-lg border px-2.5 py-1.5 text-[12px] font-medium ${style}`}>{children}</span>;
}

function Foot({ prospect, now }: { prospect: ProspectView; now: Date }) {
  const next = prospect.nextAction;
  if (!prospect.assignee && !next) return null;
  return (
    <span className="flex items-center gap-2 border-t border-outline/10 pt-2 text-[12px]">
      {prospect.assignee ? <Initials name={prospect.assignee.name} size={22} /> : null}
      <span className="min-w-0 flex-1 truncate text-on-surface-variant">{next ? `Próx: ${nextActionWhenOf(next.at, now)} · ${NEXT_ACTION_LABEL[next.kind]}` : prospect.assignee?.name}</span>
    </span>
  );
}

import { ChevronRight, Clock, ExternalLink, FileText, Link2, Package } from 'lucide-react';
import { CLIENT_SERVICE_STATUS_LABELS, serviceCardFacts, type ServiceCardFacts, type SpaceClientService } from '@lilachat/shared';
import { useCompactShell } from './ServiceShellWeb';
import { STATUS_TONE } from './tones';

const ACCENT: Record<SpaceClientService['status'], string> = { pending: 'border-l-warning', in_progress: 'border-l-primary', completed: 'border-l-en-linea', rejected: 'border-l-error' };
/** What a column says when Portal did not send its figure: never a made-up number. */
const MISSING = '—';
const KICKER = 'block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant';

function StatusPill({ service }: { service: SpaceClientService }) {
  return <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[service.status]}`}>{service.stage_label || CLIENT_SERVICE_STATUS_LABELS[service.status]}</span>;
}

function ProgressBar({ progress }: { progress: number }) {
  return <span className="block h-1.5 overflow-hidden rounded-full bg-surface-variant"><span className="block h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></span>;
}

function FigureColumn(props: { label: string; value?: number; testId: string }) {
  return (
    <span className="flex flex-col items-center border-l border-outline/15 px-4">
      <span className={KICKER}>{props.label}</span>
      <span data-testid={props.testId} className="text-xl font-extrabold tabular-nums text-on-surface">{props.value ?? MISSING}</span>
    </span>
  );
}

/** Design cc-01 on a tablet or a computer: one row with the name, the progress and the figures in columns. */
function WideSummary({ service, facts }: { service: SpaceClientService; facts: ServiceCardFacts }) {
  return (
    <span className="grid grid-cols-[minmax(0,1.6fr)_minmax(7rem,0.8fr)_auto_auto_minmax(0,1.4fr)] items-center gap-3">
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold text-on-surface">{service.name}</span>
        {facts.startLine ? <span data-testid={`inicio-servicio-${service.id}`} className="mt-1 block text-[12px] text-on-surface-variant">{facts.startLine}</span> : null}
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="flex items-center gap-2"><StatusPill service={service} />{service.progress !== undefined ? <span className="text-[13px] font-bold tabular-nums">{`${service.progress} %`}</span> : null}</span>
        {service.progress !== undefined ? <ProgressBar progress={service.progress} /> : null}
      </span>
      <FigureColumn label="Pedidos" value={facts.ordersCount} testId={`pedidos-servicio-${service.id}`} />
      <FigureColumn label="Informes" value={facts.reportsCount} testId={`informes-servicio-${service.id}`} />
      <span className="min-w-0 border-l border-outline/15 pl-4">
        <span className={KICKER}>Último movimiento</span>
        <span data-testid={`movimiento-servicio-${service.id}`} className="block truncate text-[14px] text-on-surface">{facts.lastActivity ? `${facts.lastActivity.when} · ${facts.lastActivity.text}` : MISSING}</span>
      </span>
    </span>
  );
}

/** Design cc-01 on a phone: «N pedidos · N informes · hora» and the bar «Último movimiento: … ›», only with what came. */
function CompactFacts({ service, facts }: { service: SpaceClientService; facts: ServiceCardFacts }) {
  const hasRow = Boolean(facts.ordersLabel || facts.reportsLabel || facts.lastActivity);
  if (!hasRow) return null;
  return (
    <span className="mt-3 block border-t border-outline/15 pt-3">
      <span className="flex items-center gap-4 text-[13px]">
        {facts.ordersLabel ? <span data-testid={`pedidos-servicio-${service.id}`} className="inline-flex items-center gap-1.5 font-semibold text-on-surface"><Package size={15} className="text-on-surface-variant" />{facts.ordersLabel}</span> : null}
        {facts.reportsLabel ? <span data-testid={`informes-servicio-${service.id}`} className="inline-flex items-center gap-1.5 font-semibold text-on-surface"><FileText size={15} className="text-on-surface-variant" />{facts.reportsLabel}</span> : null}
        {facts.lastActivity ? <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-on-surface-variant"><Clock size={14} />{facts.lastActivity.when}</span> : null}
      </span>
      {facts.lastActivity ? (
        <span data-testid={`movimiento-servicio-${service.id}`} className="mt-2.5 flex items-center gap-1 rounded-xl border border-outline/20 px-3 py-2 text-[13px] text-on-surface-variant">
          <span className="min-w-0 flex-1 truncate">Último movimiento: <span className="font-semibold text-on-surface">{facts.lastActivity.text}</span></span>
          <ChevronRight size={15} className="shrink-0 text-primary" />
        </span>
      ) : null}
    </span>
  );
}

function CompactSummary({ service, facts }: { service: SpaceClientService; facts: ServiceCardFacts }) {
  return (
    <>
      <span className="flex items-start gap-3">
        <span className="min-w-0 flex-1 text-[15px] font-bold text-on-surface">{service.name}</span>
        <StatusPill service={service} />
      </span>
      {service.progress !== undefined ? (
        <span className="mt-3 block">
          <span className="mb-1.5 flex justify-between text-[13px]"><span className="text-on-surface-variant">Avance</span><span className="font-bold tabular-nums text-on-surface">{`${service.progress} %`}</span></span>
          <ProgressBar progress={service.progress} />
        </span>
      ) : null}
      {/* José 31/10: «la lista de servicios no muestra la fecha». */}
      {facts.startLine ? <span data-testid={`inicio-servicio-${service.id}`} className="mt-2 block text-[12px] text-on-surface-variant">{facts.startLine}</span> : null}
      <CompactFacts service={service} facts={facts} />
    </>
  );
}

/**
 * A service of «Servicios» (José 19/11, design cc-01): a row with columns on a tablet or a
 * computer, a card on a phone. It opens the service; without the space (no way to ask), its
 * Portal link. «Enlace del servicio» stays on it (José 31/10).
 */
export function ServiceCard(props: { service: SpaceClientService; canOpen: boolean; onOpen: () => void; onShare?: () => void }) {
  const { service } = props;
  const compact = useCompactShell();
  const facts = serviceCardFacts(service, new Date());
  const summary = compact ? <CompactSummary service={service} facts={facts} /> : <WideSummary service={service} facts={facts} />;
  return (
    <article data-testid={`servicio-${service.id}`} className={`rounded-2xl border-[1.5px] border-l-4 border-outline/15 bg-surface p-4 shadow-sm hover:shadow-md md:border-y-0 md:border-r-0 ${ACCENT[service.status]}`}>
      {props.canOpen ? (
        <button type="button" data-testid={`abrir-servicio-${service.id}`} onClick={props.onOpen} className="block w-full text-left">{summary}</button>
      ) : (
        <div>
          {summary}
          {service.url ? <a href={service.url} target="_blank" rel="noreferrer" data-testid={`abrir-servicio-${service.id}`} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"><ExternalLink size={14} /> Ver en el Portal</a> : null}
        </div>
      )}
      {props.onShare ? <button type="button" data-testid={`enlace-servicio-${service.id}`} onClick={props.onShare} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-outline/20 px-3 text-[12px] font-semibold text-primary hover:bg-background"><Link2 size={14} /> Enlace del servicio</button> : null}
    </article>
  );
}

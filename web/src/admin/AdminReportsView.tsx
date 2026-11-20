import { useCallback, useState } from 'react';
import { Ban, Check, X } from 'lucide-react';
import { formatPhoneDisplay, reportReasonLabel, sortReportQueue, type AdminReport, type AdminReportPerson, type AdminReportsFilter, type ReportOutcome } from '@lilachat/shared';
import { closeAdminReport, getAdminReports } from './adminApi';
import { Dash, EmptyNote, ErrorNote, KICKER, Pager, SkeletonRows, lastPage } from './AdminParts';
import { useAdminLoad } from './useAdminLoad';

const DATE_FORMAT = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
const dateLabel = (iso: string) => DATE_FORMAT.format(new Date(iso));
const STATUS_LABEL = { open: 'Abierta', resolved: 'Resuelta', dismissed: 'Descartada' } as const;

/**
 * «Denuncias» in `/admin` (Google Play, José 19/11): the queue, child abuse on
 * top, with who reported whom, where, the note and the copy of the message;
 * each open one is resolved or dismissed with an optional note.
 */
export function AdminReportsView({ jwt }: { jwt: string }) {
  const [filter, setFilter] = useState<AdminReportsFilter>('open');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const request = useCallback((signal: AbortSignal) => getAdminReports(jwt, { filter, page }, signal), [jwt, filter, page]);
  const load = useAdminLoad(request, attempt);
  const reload = () => setAttempt((count) => count + 1);
  const data = load.status === 'ready' ? load.data : null;
  const choose = (next: AdminReportsFilter) => {
    setFilter(next);
    setPage(1);
  };
  return (
    <section className="mt-6">
      <div role="group" aria-label="Estado" className="flex w-fit rounded-lg border border-outline/15 bg-surface p-1 max-sm:w-full">
        <FilterButton active={filter === 'open'} testid="denuncias-abiertas" label={data && filter === 'open' ? `Abiertas (${data.open})` : 'Abiertas'} onClick={() => choose('open')} />
        <FilterButton active={filter === 'closed'} testid="denuncias-cerradas" label="Cerradas" onClick={() => choose('closed')} />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-outline/15 bg-surface">
        {load.status === 'error' ? <ErrorNote message={load.message} onRetry={reload} /> : data ? <ReportList reports={data.reports} filter={filter} jwt={jwt} onClosed={reload} /> : <SkeletonRows />}
        {data ? <Pager label={`${data.total} ${data.total === 1 ? 'denuncia' : 'denuncias'}`} page={data.page} last={lastPage(data.total, data.pageSize)} onPage={setPage} /> : null}
      </div>
    </section>
  );
}

function FilterButton(props: { active: boolean; testid: string; label: string; onClick: () => void }) {
  return (
    <button type="button" data-testid={props.testid} aria-pressed={props.active} onClick={props.onClick} className={`h-11 rounded-md px-4 text-sm font-semibold max-sm:flex-1 ${props.active ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
      {props.label}
    </button>
  );
}

function ReportList(props: { reports: AdminReport[]; filter: AdminReportsFilter; jwt: string; onClosed: () => void }) {
  if (props.reports.length === 0) return <EmptyNote text={props.filter === 'open' ? 'No hay denuncias abiertas.' : 'Todavía no se cerró ninguna denuncia.'} />;
  return (
    <ul className="divide-y divide-outline/10">
      {sortReportQueue(props.reports).map((report) => (
        <ReportRow key={report.id} report={report} jwt={props.jwt} onClosed={props.onClosed} />
      ))}
    </ul>
  );
}

const personLabel = (person: AdminReportPerson) => `${person.name ?? 'Sin nombre'}${person.phone ? ` · ${formatPhoneDisplay(person.phone) || person.phone}` : ''}`;

function placeLabel(report: AdminReport): string {
  const chat = report.chat ? (report.chat.kind === 'direct' ? 'Chat 1:1' : `#${report.chat.name ?? 'grupo'}`) : 'Desde su perfil';
  return report.space ? `${report.space.name} · ${chat}` : chat;
}

function ReportRow({ report, jwt, onClosed }: { report: AdminReport; jwt: string; onClosed: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = async (outcome: ReportOutcome) => {
    setBusy(true);
    setError(null);
    const result = await closeAdminReport(jwt, report.id, { outcome, note: note.trim() });
    setBusy(false);
    if (result.ok) onClosed();
    else setError(result.message);
  };
  return (
    <li data-testid={`denuncia-${report.id}`} className="flex flex-col gap-2 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {report.priority === 'high' ? <span className="rounded-full bg-error px-2.5 py-0.5 text-[12px] font-bold text-on-primary">Urgente</span> : null}
        <span className="font-semibold">{reportReasonLabel(report.reason)}</span>
        <span className="text-[12px] text-on-surface-variant">{dateLabel(report.createdAt)} · {report.target === 'message' ? 'Mensaje' : 'Persona'} · {STATUS_LABEL[report.status]}</span>
        {report.alsoBlocked ? <span className="inline-flex items-center gap-1 rounded-full border border-outline/20 px-2 py-0.5 text-[11px] text-on-surface-variant"><Ban size={12} />La bloqueó</span> : null}
      </div>
      <dl className="grid gap-1 text-sm md:grid-cols-3 md:gap-4">
        <Field label="Denunciado">{personLabel(report.reported)}</Field>
        <Field label="Lo denunció">{personLabel(report.reporter)}</Field>
        <Field label="Dónde">{placeLabel(report)}</Field>
      </dl>
      {report.note ? <p className="rounded-lg bg-background px-3 py-2 text-sm">{report.note}</p> : null}
      {report.evidence ? <Evidence evidence={report.evidence} /> : null}
      {report.status === 'open' ? (
        <div className="flex flex-wrap items-center gap-2">
          <input data-testid="denuncia-nota-cierre" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota (opcional)" className="h-11 min-w-0 flex-1 rounded-lg border border-outline/20 bg-surface px-3 text-sm outline-none focus:border-primary" />
          <button type="button" data-testid="denuncia-resolver" disabled={busy} onClick={() => void close('resolved')} className="flex h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"><Check size={16} />Resolver</button>
          <button type="button" data-testid="denuncia-descartar" disabled={busy} onClick={() => void close('dismissed')} className="flex h-11 items-center gap-1.5 rounded-lg border border-outline/30 px-4 text-sm font-semibold text-on-surface-variant disabled:opacity-60"><X size={16} />Descartar</button>
        </div>
      ) : report.closedNote ? <p className="text-[13px] text-on-surface-variant">Nota: {report.closedNote}</p> : null}
      {error ? <p role="alert" className="text-[13px] text-error">{error}</p> : null}
    </li>
  );
}

function Field({ label, children }: { label: string; children: string }) {
  return (
    <div className="min-w-0">
      <dt className={KICKER}>{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}

function Evidence({ evidence }: { evidence: NonNullable<AdminReport['evidence']> }) {
  const body = evidence.body ?? (evidence.encrypted ? 'Chat secreto: el servidor no ve el texto.' : null);
  return (
    <div data-testid="denuncia-evidencia" className="rounded-lg border border-outline/15 px-3 py-2 text-sm">
      <p className={KICKER}>Copia del mensaje · {dateLabel(evidence.sentAt)}</p>
      <p className="mt-1 whitespace-pre-wrap break-words">{body ?? <Dash />}</p>
      {evidence.mediaIds.length > 0 ? <p className="mt-1 break-all font-mono text-[12px] text-on-surface-variant">Adjuntos: {evidence.mediaIds.join(', ')}</p> : null}
    </div>
  );
}

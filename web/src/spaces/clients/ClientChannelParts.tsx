import { ServiceDriveWeb } from './ServiceDriveWeb';
import { useState } from 'react';
import { Archive, ExternalLink, FileText, FolderOpen, Search } from 'lucide-react';
import { archivedBanner, ARCHIVED_COMPOSER_NOTE, CLIENT_SERVICE_STATUS_LABELS, filterServices, recordsByService, SERVICE_FILTER_LABELS, shortDate, type ServiceFilter, type ClientRecord, type ClientServiceStatus, type SpaceClient } from '@lilachat/shared';

/** The parts of a client's channel (design f-03): the archived banner, the note over the composer and «Servicios». */
export function ArchivedClientBanner(props: { client: SpaceClient }) {
  const banner = archivedBanner(props.client);
  if (!banner) return null;
  return (
    <div data-testid="aviso-cliente-archivado" className="flex items-start gap-3 border-b border-outline/15 bg-background px-4 py-3">
      <Archive size={18} className="mt-0.5 shrink-0 text-on-surface-variant" />
      <div className="min-w-0">
        <p className="text-sm font-bold">{banner.title}</p>
        <p className="text-[13px] text-on-surface-variant">{banner.body}</p>
      </div>
    </div>
  );
}

export function ArchivedComposerNote(props: { client: SpaceClient }) {
  return props.client.live ? null : <p data-testid="nota-archivado" className="border-t border-outline/15 bg-surface px-4 pt-2 text-center text-[12px] text-on-surface-variant">{ARCHIVED_COMPOSER_NOTE}</p>;
}

const STATUS_TONE: Record<ClientServiceStatus, string> = {
  pending: 'border-warning/30 bg-warning/10 text-warning',
  in_progress: 'border-primary/30 bg-primary/10 text-primary',
  completed: 'border-en-linea/30 bg-en-linea/10 text-en-linea',
  rejected: 'border-error/30 bg-error/10 text-error',
};

/**
 * «Servicios»: the client's Drive on top (José, 29/10), then each service with
 * its state, its progress (the client portal's), «Ver en el Drive» and its
 * records (informes, quotes, payments) — tapping one goes to its message.
 */
export function ClientServices(props: { client: SpaceClient; records: ClientRecord[] | null; onOpenRecord?: (seq: number) => void; drive?: { jwt: string; spaceId: string } }) {
  const [query, setQuery] = useState('');
  const [driveOf, setDriveOf] = useState<{ id: string; name: string } | null>(null);
  const [filter, setFilter] = useState<ServiceFilter>('all');
  const { services, counts } = filterServices(props.client.services, { query, filter });
  const grouped = props.records ? recordsByService(props.records) : null;
  return (
    <div data-testid="servicios-cliente" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
      {driveOf && props.drive ? <ServiceDriveWeb jwt={props.drive.jwt} spaceId={props.drive.spaceId} clientId={props.client.id} service={driveOf} onClose={() => setDriveOf(null)} /> : null}
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {props.client.drive_url ? (
          <a href={props.client.drive_url} target="_blank" rel="noreferrer" data-testid="drive-cliente" className="flex items-center gap-3 rounded-xl border border-outline/15 bg-surface p-4 hover:bg-background">
            <FolderOpen size={20} className="text-primary" />
            <span className="min-w-0 flex-1"><span className="block font-semibold">Drive del cliente</span><span className="block text-[12px] text-on-surface-variant">Todas sus carpetas en el Portal</span></span>
            <ExternalLink size={16} className="text-on-surface-variant" />
          </a>
        ) : null}
        {props.client.services.length > 1 ? (
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-outline/15 bg-surface px-3">
              <Search size={15} className="text-on-surface-variant" />
              <input data-testid="buscar-servicio" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar servicio" aria-label="Buscar servicio" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
              {(Object.keys(SERVICE_FILTER_LABELS) as ServiceFilter[]).map((key) => (
                <button key={key} type="button" data-testid={`filtro-servicio-${key}`} aria-pressed={filter === key} onClick={() => setFilter(key)} className={`h-8 rounded-full border px-3 text-[12px] font-semibold ${filter === key ? 'border-primary bg-primary text-on-primary' : 'border-outline/20 bg-surface text-on-surface-variant hover:text-on-surface'}`}>{`${SERVICE_FILTER_LABELS[key]} · ${counts[key]}`}</button>
              ))}
            </div>
          </div>
        ) : null}
        {props.client.services.length === 0 ? <p className="pt-10 text-center text-sm text-on-surface-variant">Este cliente todavía no tiene servicios.</p> : null}
        {props.client.services.length > 0 && services.length === 0 ? <p className="pt-6 text-center text-sm text-on-surface-variant">Ningún servicio con ese filtro.</p> : null}
        {services.map((service) => (
          <article key={service.id} data-testid={`servicio-${service.id}`} className="rounded-xl border border-outline/15 bg-surface p-4">
            <div className="flex items-start gap-3">
              <p className="min-w-0 flex-1 font-semibold">{service.name}</p>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{service.stage_label || CLIENT_SERVICE_STATUS_LABELS[service.status]}</span>
            </div>
            {service.progress !== undefined ? (
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${service.progress}%` }} /></div>
                <span className="text-[12px] font-semibold tabular-nums text-on-surface-variant">{`${service.progress} %`}</span>
              </div>
            ) : null}
            {props.drive ? (
              <button type="button" data-testid={`servicio-drive-${service.id}`} onClick={() => setDriveOf({ id: service.id, name: service.name })} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"><FolderOpen size={14} /> Drive del servicio</button>
            ) : service.url ? (
              <a href={service.url} target="_blank" rel="noreferrer" data-testid={`servicio-drive-${service.id}`} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"><ExternalLink size={14} /> Ver en el Drive</a>
            ) : null}
            <ServiceRecords records={grouped ? (grouped.get(service.id) ?? []) : null} onOpen={props.onOpenRecord} />
          </article>
        ))}
      </div>
    </div>
  );
}

function ServiceRecords(props: { records: ClientRecord[] | null; onOpen?: (seq: number) => void }) {
  if (props.records === null) return <div className="mt-3 h-8 animate-pulse rounded-lg bg-background" />;
  if (props.records.length === 0) return null;
  return (
    <ul className="mt-3 divide-y divide-outline/10 border-t border-outline/10">
      {props.records.map((record) => (
        <li key={record.seq}>
          <button type="button" data-testid={`registro-${record.seq}`} onClick={() => props.onOpen?.(record.seq)} className="flex w-full items-center gap-2.5 py-2 text-left hover:bg-background">
            <FileText size={15} className="shrink-0 text-on-surface-variant" />
            <span className="min-w-0 flex-1">
              {record.kicker ? <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{record.kicker}</span> : null}
              <span className="block truncate text-[13px]">{record.title}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">{shortDate(record.at)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

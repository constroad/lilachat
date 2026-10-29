import { Archive, ExternalLink } from 'lucide-react';
import { archivedBanner, ARCHIVED_COMPOSER_NOTE, CLIENT_SERVICE_STATUS_LABELS, type ClientServiceStatus, type SpaceClient } from '@lilachat/shared';

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

/** «Servicios»: each service with its state, its progress (the client portal's) and «Ver en el Drive» when Portal sends the link. */
export function ClientServices(props: { client: SpaceClient }) {
  const { services } = props.client;
  return (
    <div data-testid="servicios-cliente" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
      {services.length === 0 ? <p className="pt-10 text-center text-sm text-on-surface-variant">Este cliente todavía no tiene servicios.</p> : null}
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
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
            {service.url ? (
              <a href={service.url} target="_blank" rel="noreferrer" data-testid={`servicio-drive-${service.id}`} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"><ExternalLink size={14} /> Ver en el Drive</a>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

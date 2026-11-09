import { useEffect, useState } from 'react';
import { Archive, ChevronRight, ExternalLink, FolderOpen, Link2, Search } from 'lucide-react';
import { archivedBanner, ARCHIVED_COMPOSER_NOTE, CLIENT_SERVICE_STATUS_LABELS, filterServices, serviceAccessOf, orderFocusOf, SERVICE_FILTER_LABELS, dayOf, type ChannelLinks, type ServiceFilter, type ClientRecord, type SpaceClient, type SpaceClientService } from '@lilachat/shared';
import { ServiceDetailWeb } from './ServiceDetailWeb';
import { STATUS_TONE } from './tones';
import type { ServiceAskTarget } from './useServiceAsk';

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

function ServiceFilters(props: { query: string; onQuery: (query: string) => void; filter: ServiceFilter; onFilter: (filter: ServiceFilter) => void; counts: Record<ServiceFilter, number> }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-outline/15 bg-surface px-3">
        <Search size={15} className="text-on-surface-variant" />
        <input data-testid="buscar-servicio" value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="Buscar servicio" aria-label="Buscar servicio" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
        {(Object.keys(SERVICE_FILTER_LABELS) as ServiceFilter[]).map((key) => (
          <button key={key} type="button" data-testid={`filtro-servicio-${key}`} aria-pressed={props.filter === key} onClick={() => props.onFilter(key)} className={`h-8 rounded-full border px-3 text-[12px] font-semibold ${props.filter === key ? 'border-primary bg-primary text-on-primary' : 'border-outline/20 bg-surface text-on-surface-variant hover:text-on-surface'}`}>{`${SERVICE_FILTER_LABELS[key]} · ${props.counts[key]}`}</button>
        ))}
      </div>
    </div>
  );
}

function ServiceSummary({ service }: { service: SpaceClientService }) {
  return (
    <>
      <span className="flex items-start gap-3">
        <span className="min-w-0 flex-1 font-semibold">{service.name}</span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{service.stage_label || CLIENT_SERVICE_STATUS_LABELS[service.status]}</span>
      </span>
      {/* José 31/10: «la lista de servicios no muestra la fecha». */}
      {service.started_at ? <span data-testid={`inicio-servicio-${service.id}`} className="mt-1 block text-[12px] text-on-surface-variant">{`Inicio ${dayOf(service.started_at)}`}</span> : null}
      {service.progress !== undefined ? (
        <span className="mt-3 flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-background"><span className="block h-full rounded-full bg-primary" style={{ width: `${service.progress}%` }} /></span>
          <span className="text-[12px] font-semibold tabular-nums text-on-surface-variant">{`${service.progress} %`}</span>
        </span>
      ) : null}
    </>
  );
}

/** The head opens its expediente; without the space (no way to ask), its Portal link. «Enlace del servicio» makes its link (José 31/10). */
function ServiceCard(props: { service: SpaceClientService; canOpen: boolean; onOpen: () => void; onShare?: () => void }) {
  const { service } = props;
  const head = 'block w-full text-left';
  return (
    <article data-testid={`servicio-${service.id}`} className="rounded-xl border border-outline/15 bg-surface p-4">
      {props.canOpen ? (
        <button type="button" data-testid={`abrir-servicio-${service.id}`} onClick={props.onOpen} className={head}>
          <ServiceSummary service={service} />
          <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-primary">Pedidos, despachos e informes <ChevronRight size={14} /></span>
        </button>
      ) : (
        <div className={head}>
          <ServiceSummary service={service} />
          {service.url ? <a href={service.url} target="_blank" rel="noreferrer" data-testid={`abrir-servicio-${service.id}`} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"><ExternalLink size={14} /> Ver en el Portal</a> : null}
        </div>
      )}
      {props.onShare ? <button type="button" data-testid={`enlace-servicio-${service.id}`} onClick={props.onShare} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-outline/20 px-3 text-[12px] font-semibold text-primary hover:bg-background"><Link2 size={14} /> Enlace del servicio</button> : null}
    </article>
  );
}

const ClientDriveLink = ({ url }: { url: string }) => (
  <a href={url} target="_blank" rel="noreferrer" data-testid="drive-cliente" className="flex items-center gap-3 rounded-xl border border-outline/15 bg-surface p-4 hover:bg-background">
    <FolderOpen size={20} className="text-primary" />
    <span className="min-w-0 flex-1"><span className="block font-semibold">Drive del cliente</span><span className="block text-[12px] text-on-surface-variant">Todas sus carpetas en el Portal</span></span>
    <ExternalLink size={16} className="text-on-surface-variant" />
  </a>
);

/**
 * «Servicios»: each service with its state, its progress (the client portal's)
 * and its records (informes, quotes, payments) — tapping one goes to its
 * message. The service opens its expediente with its Drive (José, 06/11).
 */
export function ClientServices(props: { /** Who can be a report's responsible. */ people?: readonly string[]; /** The channel hides its chrome while a service is open. */ onServiceOpen?: (open: boolean) => void; onToChat?: () => void; client: SpaceClient; records: ClientRecord[] | null; target: ServiceAskTarget | null; links?: ChannelLinks; /** The message of the order's card that sent here. */ focusSeq?: number | null; onFocused?: () => void }) {
  const { links } = props;
  const clientId = props.client.id;
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState<SpaceClientService | null>(null);
  const [filter, setFilter] = useState<ServiceFilter>('all');
  const [startOrderId, setStartOrderId] = useState<string | undefined>();
  // The map takes the whole conversation (o-01): no padding and its own scroll.
  const [mapOpen, setMapOpen] = useState(false);
  const { focusSeq, records, onFocused } = props;
  const clientServices = props.client.services;
  // The records say which order the card was: until they arrive, this waits.
  useEffect(() => {
    if (focusSeq === null || focusSeq === undefined || !records) return;
    const focus = orderFocusOf(clientServices, records, focusSeq);
    if (focus) { setStartOrderId(focus.orderId); setOpened(focus.service); }
    onFocused?.();
  }, [focusSeq, records, clientServices, onFocused]);
  const showsDetail = Boolean(opened && props.target);
  const { onServiceOpen } = props;
  useEffect(() => {
    onServiceOpen?.(showsDetail);
    return () => onServiceOpen?.(false);
  }, [showsDetail, onServiceOpen]);
  const { services, counts } = filterServices(props.client.services, { query, filter });
  const total = props.client.services.length;
  const sees = serviceAccessOf(props.client.access);
  return (
    <div data-testid="servicios-cliente" className={`min-h-0 flex-1 bg-background ${mapOpen && opened ? 'flex flex-col overflow-hidden' : 'overflow-y-auto p-4 md:p-6'}`}>
      {opened && props.target ? (
        <ServiceDetailWeb people={props.people ?? []} target={props.target} chatId={props.client.chat_id} service={opened} seesMoney={Boolean(props.client.access?.money)} admin={Boolean(props.client.access?.admin)} seesDrive={sees.drive} driveOnly={!sees.detail} onBack={() => setOpened(null)} onToChat={props.onToChat} links={links} startOrderId={startOrderId} onMapOpen={setMapOpen} />
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {/* José 31/10: the client's link here; an order's in its sheet, a service's on its card. */}
          {links?.can('client') ? <button type="button" data-testid="enlace-cliente" onClick={() => links.open({ kind: 'client', clientId })} className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg border border-primary/30 bg-primary/10 px-3 text-[13px] font-semibold text-primary hover:bg-primary/15"><Link2 size={15} /> Enlace del cliente</button> : null}
          {sees.drive && props.client.drive_url ? <ClientDriveLink url={props.client.drive_url} /> : null}
          {total > 1 ? <ServiceFilters query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} counts={counts} /> : null}
          {total === 0 ? <p className="pt-10 text-center text-sm text-on-surface-variant">Este cliente todavía no tiene servicios.</p> : null}
          {total > 0 && services.length === 0 ? <p className="pt-6 text-center text-sm text-on-surface-variant">Ningún servicio con ese filtro.</p> : null}
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} canOpen={Boolean(props.target)} onOpen={() => setOpened(service)} onShare={links?.can('service') ? () => links.open({ kind: 'service', clientId, serviceId: service.id }) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}


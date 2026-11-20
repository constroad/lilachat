import { useEffect, useState } from 'react';
import { AlertCircle, Archive, ChevronRight, FolderOpen, Link2, Search } from 'lucide-react';
import { archivedBanner, ARCHIVED_COMPOSER_NOTE, filterServices, pendingPreview, serviceAccessOf, serviceSegmentsOf, orderFocusOf, type ChannelLinks, type ServiceFilter, type ClientRecord, type SpaceClient, type SpaceClientService, type WorkStage } from '@lilachat/shared';
import { ServiceDetailWeb } from './ServiceDetailWeb';
import { ServiceCard } from './ServiceCardWeb';
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
    <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-2 md:rounded-2xl md:border md:border-outline/15 md:bg-surface md:p-1.5">
      <label className="flex h-10 flex-1 items-center gap-2 rounded-xl bg-background px-3 max-md:border-[1.5px] max-md:border-outline/20 max-md:bg-surface">
        <Search size={15} className="text-on-surface-variant" />
        <input data-testid="buscar-servicio" value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="Buscar servicio" aria-label="Buscar servicio" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      {/* Design cc-01: a segmented control, «Rechazados» only when there is one. */}
      <div role="group" aria-label="Filtrar por estado" className="flex gap-1 rounded-xl bg-background p-1 max-md:border-[1.5px] max-md:border-outline/20 max-md:bg-surface">
        {serviceSegmentsOf(props.counts).map((one) => (
          <button key={one.key} type="button" data-testid={`filtro-servicio-${one.key}`} aria-pressed={props.filter === one.key} onClick={() => props.onFilter(one.key)} className={`h-8 flex-1 whitespace-nowrap rounded-lg px-2 text-[13px] font-semibold md:flex-none md:px-3 ${props.filter === one.key ? 'bg-primary text-on-primary shadow-sm md:bg-surface md:text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{one.label} <span className="tabular-nums">{one.count}</span></button>
        ))}
      </div>
    </div>
  );
}

/** Design cc-01 mobile: the open tasks over the list, «Ver en Checklist» takes there. */
function PendingBlock(props: { pending: ChannelPending }) {
  const { tasks, total } = pendingPreview(props.pending.stages, new Date());
  if (!total) return null;
  return (
    <section data-testid="servicios-pendientes" className="rounded-2xl border border-outline/15 border-t-[3px] border-t-warning bg-surface p-3">
      <p className="flex items-center justify-between px-1 pb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-warning">
        {`Pendientes · ${total}`}
        <button type="button" data-testid="ver-en-checklist" onClick={props.pending.onOpen} className="inline-flex items-center gap-0.5 font-sans text-[13px] font-semibold normal-case tracking-normal text-primary">{props.pending.label} <ChevronRight size={14} /></button>
      </p>
      <ul className="flex flex-col gap-1.5">
        {tasks.map((task) => (
          <li key={`${task.stageId}-${task.item.id}`} className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/5 px-3 py-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-warning" />
            <span className="min-w-0"><span className="block text-[14px] font-semibold text-on-surface">{task.item.text}</span><span className="block text-[12px] text-on-surface-variant">{`Etapa ${task.stage}`}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The plan's stages and the way to «Checklist»: only on a phone, where «Pendientes» is not a tab. */
export type ChannelPending = { stages: readonly WorkStage[]; /** «Ver en Checklist», or «Ver pendientes» for whoever has no checklist. */ label: string; onOpen: () => void };

function ListHead(props: { client: SpaceClient; links?: ChannelLinks; seesDrive: boolean }) {
  const { links } = props;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Servicios del cliente</p>
        <h2 className="text-[28px] font-extrabold leading-[34px] tracking-tight text-primary">Servicios</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* José 31/10: the client's link here; an order's in its sheet, a service's in its head. */}
        {links?.can('client') ? <button type="button" data-testid="enlace-cliente" onClick={() => links.open({ kind: 'client', clientId: props.client.id })} className={HEAD_BUTTON}><Link2 size={15} /> Enlace del cliente</button> : null}
        {props.seesDrive && props.client.drive_url ? <a href={props.client.drive_url} target="_blank" rel="noreferrer" data-testid="drive-cliente" className={HEAD_BUTTON}><FolderOpen size={15} /> Drive del cliente</a> : null}
      </div>
    </div>
  );
}

const HEAD_BUTTON = 'inline-flex h-10 items-center gap-1.5 rounded-xl border border-outline/20 bg-surface px-3 text-[13px] font-semibold text-on-surface hover:bg-background';

/**
 * «Servicios» (José 19/11, design cc-01): the client's link and Drive, the search with «Abiertos ·
 * Completados · Todos», and a card per service; on a phone the open tasks go first. The service
 * opens under the channel's tabs (tablet, computer) or over the whole screen (phone).
 */
export function ClientServices(props: { /** Who can be a report's responsible. */ people?: readonly string[]; /** The channel hides its chrome while a service is open on a phone. */ onServiceOpen?: (open: boolean) => void; client: SpaceClient; records: ClientRecord[] | null; target: ServiceAskTarget | null; links?: ChannelLinks; /** The message of the order's card that sent here. */ focusSeq?: number | null; onFocused?: () => void; pending?: ChannelPending }) {
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState<SpaceClientService | null>(null);
  const [filter, setFilter] = useState<ServiceFilter>('all');
  const [startOrderId, setStartOrderId] = useState<string | undefined>();
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
  if (opened && props.target) {
    return (
      <div data-testid="servicios-cliente" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <ServiceDetailWeb people={props.people ?? []} target={props.target} chatId={props.client.chat_id} clientName={props.client.name} service={opened} seesMoney={Boolean(props.client.access?.money)} admin={Boolean(props.client.access?.admin)} seesDrive={sees.drive} driveOnly={!sees.detail} onBack={() => setOpened(null)} links={props.links} startOrderId={startOrderId} />
      </div>
    );
  }
  return (
    <div data-testid="servicios-cliente" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        {props.pending ? <PendingBlock pending={props.pending} /> : null}
        <ListHead client={props.client} links={props.links} seesDrive={sees.drive} />
        {total > 1 ? <ServiceFilters query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} counts={counts} /> : null}
        {total === 0 ? <p className="pt-10 text-center text-sm text-on-surface-variant">Este cliente todavía no tiene servicios.</p> : null}
        {total > 0 && services.length === 0 ? <p className="pt-6 text-center text-sm text-on-surface-variant">Ningún servicio con ese filtro.</p> : null}
        {services.map((service) => <ServiceCard key={service.id} service={service} canOpen={Boolean(props.target)} onOpen={() => setOpened(service)} onShare={props.links?.can('service') ? () => props.links?.open({ kind: 'service', clientId: props.client.id, serviceId: service.id }) : undefined} />)}
      </div>
    </div>
  );
}

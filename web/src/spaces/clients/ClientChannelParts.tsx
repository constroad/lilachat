import { useEffect, useState, type ReactNode } from 'react';
import { Archive, FolderOpen, Link2, MoreVertical, Search } from 'lucide-react';
import { archivedBanner, ARCHIVED_COMPOSER_NOTE, clientChannelMenuOf, filterServices, serviceAccessOf, serviceSegmentsOf, orderFocusOf, type ChannelLinks, type ServiceFilter, type ClientRecord, type SpaceClient, type SpaceClientService } from '@lilachat/shared';
import { ServiceDetailWeb } from './ServiceDetailWeb';
import { useDismiss } from './workMap/MapMoreMenu';
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

function ServiceFilters(props: { query: string; onQuery: (query: string) => void; filter: ServiceFilter; onFilter: (filter: ServiceFilter) => void; counts: Record<ServiceFilter, number>; /** The channel's menu, on the search's row (José 28/11). */ menu: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-2 md:rounded-2xl md:border md:border-outline/15 md:bg-surface md:p-1.5">
      <div className="flex flex-1 items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-background px-3 max-md:border-[1.5px] max-md:border-outline/20 max-md:bg-surface">
          <Search size={15} className="text-on-surface-variant" />
          <input data-testid="buscar-servicio" value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="Buscar servicio" aria-label="Buscar servicio" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        {props.menu}
      </div>
      {/* Design cc-01: a segmented control, «Rechazados» only when there is one. */}
      <div role="group" aria-label="Filtrar por estado" className="flex gap-1 rounded-xl bg-background p-1 max-md:border-[1.5px] max-md:border-outline/20 max-md:bg-surface">
        {serviceSegmentsOf(props.counts).map((one) => (
          <button key={one.key} type="button" data-testid={`filtro-servicio-${one.key}`} aria-pressed={props.filter === one.key} onClick={() => props.onFilter(one.key)} className={`h-8 flex-1 whitespace-nowrap rounded-lg px-2 text-[13px] font-semibold md:flex-none md:px-3 ${props.filter === one.key ? 'bg-primary text-on-primary shadow-sm md:bg-surface md:text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{one.label} <span className="tabular-nums">{one.count}</span></button>
        ))}
      </div>
    </div>
  );
}

const MENU_ITEM = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] font-semibold text-on-surface hover:bg-background';

/**
 * One ⋮ beside «Buscar servicio» (José 28/11: the head's big buttons became one): the client's link and
 * its Drive. On the web «Accesos del canal» lives in the channel's info, «Miembros».
 */
function ChannelMenu(props: { client: SpaceClient; links?: ChannelLinks; seesDrive: boolean }) {
  const { links } = props;
  const [open, setOpen] = useState(false);
  const holder = useDismiss(open, () => setOpen(false));
  const driveUrl = props.client.drive_url;
  const items = clientChannelMenuOf({ link: Boolean(links?.can('client')), accessRestricted: null, drive: props.seesDrive && Boolean(driveUrl) });
  if (!items.length) return null;
  return (
    <div ref={holder} className="relative shrink-0">
      <button type="button" data-testid="menu-canal-cliente" aria-label="Opciones del cliente" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((shown) => !shown)} className="grid h-11 w-11 place-items-center rounded-xl border border-outline/20 bg-surface text-on-surface hover:bg-background"><MoreVertical size={18} /></button>
      {open ? (
        <div role="menu" data-testid="menu-canal-cliente-hoja" className="absolute right-0 top-full z-30 mt-1 w-60 rounded-xl border border-outline/15 bg-surface p-1.5 shadow-lg">
          {links && items.some((item) => item.key === 'link') ? <button type="button" role="menuitem" data-testid="enlace-cliente" onClick={() => { setOpen(false); links.open({ kind: 'client', clientId: props.client.id }); }} className={MENU_ITEM}><Link2 size={16} className="shrink-0 text-primary" /> Enlace del cliente</button> : null}
          {driveUrl && items.some((item) => item.key === 'drive') ? <a role="menuitem" href={driveUrl} target="_blank" rel="noreferrer" data-testid="drive-cliente" onClick={() => setOpen(false)} className={MENU_ITEM}><FolderOpen size={16} className="shrink-0 text-primary" /> Drive del cliente</a> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * «Servicios» (José 19/11, design cc-01): the client's link and Drive, the search with «Abiertos ·
 * Completados · Todos», and a card per service; on a phone the open tasks go first. The service
 * opens under the channel's tabs (tablet, computer) or over the whole screen (phone).
 */
export function ClientServices(props: { /** Who can be a report's responsible. */ people?: readonly string[]; /** The channel hides its chrome while a service is open on a phone. */ onServiceOpen?: (open: boolean) => void; client: SpaceClient; records: ClientRecord[] | null; target: ServiceAskTarget | null; links?: ChannelLinks; /** The message of the order's card that sent here. */ focusSeq?: number | null; onFocused?: () => void; /** A card's `open: { route: 'service' }` (agentes, 20/11): the service to open directly, no order lookup. */ focusServiceId?: string | null; /** With it, an «INFORME» card's report opens on top of Informes (José 25/11). */ focusReportId?: string | null; onServiceFocused?: () => void }) {
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState<SpaceClientService | null>(null);
  const [filter, setFilter] = useState<ServiceFilter>('all');
  const [startOrderId, setStartOrderId] = useState<string | undefined>();
  const [startReportId, setStartReportId] = useState<string | undefined>();
  const { focusSeq, records, onFocused, focusServiceId, focusReportId, onServiceFocused } = props;
  const clientServices = props.client.services;
  // The records say which order the card was: until they arrive, this waits.
  useEffect(() => {
    if (focusSeq === null || focusSeq === undefined || !records) return;
    const focus = orderFocusOf(clientServices, records, focusSeq);
    if (focus) { setStartOrderId(focus.orderId); setOpened(focus.service); }
    onFocused?.();
  }, [focusSeq, records, clientServices, onFocused]);
  // A direct service id needs no records: it opens as soon as the client's own list has it.
  useEffect(() => {
    if (!focusServiceId) return;
    const service = clientServices.find((one) => one.id === focusServiceId);
    if (service) { setStartReportId(focusReportId ?? undefined); setOpened(service); }
    onServiceFocused?.();
  }, [focusServiceId, focusReportId, clientServices, onServiceFocused]);
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
        <ServiceDetailWeb key={`${opened.id}:${startReportId ?? ''}`} people={props.people ?? []} target={props.target} chatId={props.client.chat_id} clientName={props.client.name} service={opened} seesMoney={Boolean(props.client.access?.money)} admin={Boolean(props.client.access?.admin)} seesDrive={sees.drive} driveOnly={!sees.detail} onBack={() => { setOpened(null); setStartReportId(undefined); }} links={props.links} startOrderId={startOrderId} startReportId={startReportId} />
      </div>
    );
  }
  const menu = <ChannelMenu client={props.client} links={props.links} seesDrive={sees.drive} />;
  return (
    <div data-testid="servicios-cliente" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        {total > 1 ? <ServiceFilters query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} counts={counts} menu={menu} /> : <div className="flex justify-end">{menu}</div>}
        {total === 0 ? <p className="pt-10 text-center text-sm text-on-surface-variant">Este cliente todavía no tiene servicios.</p> : null}
        {total > 0 && services.length === 0 ? <p className="pt-6 text-center text-sm text-on-surface-variant">Ningún servicio con ese filtro.</p> : null}
        {services.map((service) => <ServiceCard key={service.id} service={service} canOpen={Boolean(props.target)} onOpen={() => setOpened(service)} onShare={props.links?.can('service') ? () => props.links?.open({ kind: 'service', clientId: props.client.id, serviceId: service.id }) : undefined} />)}
      </div>
    </div>
  );
}

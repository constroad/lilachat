import type { ReactNode } from 'react';
import { CLIENT_SERVICE_STATUS_LABELS, portalMapTabUrl, type ChannelLinks, type ServiceDetail, type ServiceTabKey, type SpaceClientService } from '@lilachat/shared';
import { ServiceMapWeb } from '../ServiceMapWeb';
import { STATUS_TONE } from '../tones';
import type { ServiceAskTarget } from '../useServiceAsk';
import { workProgressSender } from './workProgressSender';

type Tab = { key: ServiceTabKey; label: string };

/** The service's tabs as the design's underline (o-01); the map is the one open. */
function UnderlineTabs(props: { tabs: Tab[]; onTab: (tab: ServiceTabKey) => void }) {
  return (
    <div role="tablist" className="-mb-px mt-1 flex gap-5 overflow-x-auto">
      {props.tabs.map((one) => {
        const open = one.key === 'map';
        return (
          <button key={one.key} type="button" role="tab" aria-selected={open} data-testid={`pestana-detalle-${one.key}`} onClick={() => props.onTab(one.key)} className={`h-10 shrink-0 border-b-2 text-[14px] ${open ? 'border-primary font-semibold text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
            {open ? <><span className="hidden md:inline">Mapa de la obra</span><span className="md:hidden">Mapa</span></> : one.label}
          </button>
        );
      })}
    </div>
  );
}

type WorkspaceProps = { crumbs: ReactNode; detail: ServiceDetail; service: SpaceClientService; tabs: Tab[]; onTab: (tab: ServiceTabKey) => void; links: ChannelLinks; target: ServiceAskTarget; chatId: string };

/**
 * The map tab takes the whole conversation (design `o-01-mapa-obra`; José 07/11 said the web did
 * not look like the design): the crumbs and the tabs go in the map's own bar.
 */
export function MapWorkspace(props: WorkspaceProps) {
  const { service, target } = props;
  const head = (
    <>
      {props.crumbs}
      <h2 className="mt-1 text-lg font-bold text-on-surface md:hidden">Mapa de la obra</h2>
    </>
  );
  const badge = <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{CLIENT_SERVICE_STATUS_LABELS[service.status]}</span>;
  return (
    <div data-testid="detalle-servicio" className="flex min-h-0 flex-1 flex-col">
      <ServiceMapWeb jwt={target.jwt} links={props.links} target={{ kind: 'service', clientId: target.clientId, serviceId: service.id }} title={service.name} head={head} tabs={<UnderlineTabs tabs={props.tabs} onTab={props.onTab} />} badge={badge} drawUrl={portalMapTabUrl(props.detail.service.url)} discharges={props.detail.discharges} send={workProgressSender(target, props.chatId, service.id)} />
    </div>
  );
}

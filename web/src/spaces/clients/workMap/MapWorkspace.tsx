import type { LiftRow } from './WorkMapItems';
import type { ReactNode } from 'react';
import { CLIENT_SERVICE_STATUS_LABELS, portalMapTabUrl, type ChannelLinks, type ServiceDetail, type SpaceClientService } from '@lilachat/shared';
import { ServiceMapWeb } from '../ServiceMapWeb';
import { STATUS_TONE } from '../tones';
import type { ServiceAskTarget } from '../useServiceAsk';
import { mapPhotoUploader, mapTraceUploader } from '../useDriveUpload';
import { mapEditSender, workProgressSender, workStreetDeleteSender, workStreetSender } from './workProgressSender';

type WorkspaceProps = { /** «Levantar» on an open observation (José 27/11). */ onLift?: (row: LiftRow) => void; /** A space admin: «Borrados» on the map (José 07/11). */ admin?: boolean; /** Over Portal's editor, the way back to the report; inside the service, nothing: the service's head and bar are above. */ crumbs?: ReactNode; detail: ServiceDetail; service: SpaceClientService; links: ChannelLinks; target: ServiceAskTarget; chatId: string };

/**
 * The map section of a service (design `o-01-mapa-obra`, José 19/11 design cc-04): under the
 * service's head and tab bar, edge to edge; its actions go to the right of that bar.
 */
export function MapWorkspace(props: WorkspaceProps) {
  const { service, target } = props;
  const badge = <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{CLIENT_SERVICE_STATUS_LABELS[service.status]}</span>;
  return (
    <div data-testid="mapa-seccion" className="flex min-h-0 flex-1 flex-col">
      <ServiceMapWeb onLift={props.onLift} jwt={target.jwt} links={props.links} target={{ kind: 'service', clientId: target.clientId, serviceId: service.id }} title={service.name} head={props.crumbs} badge={badge} drawUrl={portalMapTabUrl(props.detail.service.url)} discharges={props.detail.discharges} mapPhotos={props.detail.mapPhotos} start={props.detail.service.location} send={workProgressSender(target, props.chatId, service.id)} drawStreet={workStreetSender(target, props.chatId, service.id)} deleteStreet={workStreetDeleteSender(target, props.chatId, service.id)} editMap={mapEditSender(target, props.chatId, service.id)} admin={props.admin} uploadPhoto={mapPhotoUploader(target, props.chatId, service.id)} uploadTrace={mapTraceUploader(target, props.chatId, service.id)} mapInReport={props.detail.service.mapInReport} />
    </div>
  );
}

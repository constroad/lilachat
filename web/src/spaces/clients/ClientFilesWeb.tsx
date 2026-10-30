import { useState } from 'react';
import { ChevronRight, ExternalLink, Folder, FolderOpen } from 'lucide-react';
import { stageFiles, type SpaceClient, type SpaceClientService, type WorkStage } from '@lilachat/shared';
import { StageFilesWeb } from '../../chat/workPlan/WorkListsWeb';
import { ServiceDriveWeb } from './ServiceDriveWeb';
import type { ServiceAskTarget } from './useServiceAsk';

type Source = 'channel' | 'drive';

const ClientDriveLink = ({ url }: { url: string }) => (
  <a href={url} target="_blank" rel="noreferrer" data-testid="drive-cliente" className="flex items-center gap-3 rounded-xl border border-outline/15 bg-surface p-4 hover:bg-background">
    <FolderOpen size={20} className="text-primary" />
    <span className="min-w-0 flex-1"><span className="block font-semibold">Drive del cliente</span><span className="block text-[12px] text-on-surface-variant">Todas sus carpetas en el Portal</span></span>
    <ExternalLink size={16} className="text-on-surface-variant" />
  </a>
);

/** One row per service; without the space (no way to ask), its Portal link. */
function ServicePicker(props: { client: SpaceClient; canAsk: boolean; onPick: (service: SpaceClientService) => void }) {
  if (!props.client.services.length) return <p className="pt-6 text-center text-sm text-on-surface-variant">Este cliente todavía no tiene servicios.</p>;
  const row = 'flex min-h-[52px] w-full items-center gap-3 px-3 text-left hover:bg-background';
  return (
    <section>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Drive de cada servicio</p>
      <div className="divide-y divide-outline/10 overflow-hidden rounded-xl border border-outline/15 bg-surface">
        {props.client.services.map((service) => {
          const body = <><Folder size={18} className="text-primary" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{service.name}</span><ChevronRight size={15} className="text-on-surface-variant" /></>;
          if (props.canAsk) return <button key={service.id} type="button" data-testid={`drive-de-${service.id}`} onClick={() => props.onPick(service)} className={row}>{body}</button>;
          return service.url ? <a key={service.id} href={service.url} target="_blank" rel="noreferrer" data-testid={`drive-de-${service.id}`} className={row}>{body}</a> : null;
        })}
      </div>
    </section>
  );
}

function SourceSwitch(props: { source: Source; channelFiles: number; onSource: (source: Source) => void }) {
  const options: { key: Source; label: string }[] = [
    { key: 'channel', label: props.channelFiles ? `Del canal · ${props.channelFiles}` : 'Del canal' },
    { key: 'drive', label: 'Drive del Portal' },
  ];
  return (
    <div role="tablist" className="mx-auto flex w-full max-w-3xl gap-1 rounded-xl border border-outline/15 bg-surface p-1">
      {options.map((one) => (
        <button key={one.key} type="button" role="tab" aria-selected={props.source === one.key} data-testid={`archivos-${one.key}`} onClick={() => props.onSource(one.key)} className={`h-9 flex-1 rounded-lg text-sm ${props.source === one.key ? 'bg-primary font-semibold text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{one.label}</button>
      ))}
    </div>
  );
}

/**
 * «Archivos» of a client's channel, ONE tab (José, 30/10: «una sola pestaña
 * Archivos»): what was uploaded to the checklist («Del canal») and Portal's
 * Drive, per service. The Drive left «Servicios».
 */
export function ClientFilesWeb(props: { client: SpaceClient; target: ServiceAskTarget | null; stages: readonly WorkStage[]; onOpenMessage: (seq: number) => void }) {
  const channelFiles = stageFiles(props.stages).total;
  const [source, setSource] = useState<Source>(channelFiles ? 'channel' : 'drive');
  const [service, setService] = useState<SpaceClientService | null>(null);
  const { target } = props;
  return (
    <div data-testid="archivos-cliente" className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="px-4 pt-3 md:px-6"><SourceSwitch source={source} channelFiles={channelFiles} onSource={setSource} /></div>
      {source === 'channel' ? <StageFilesWeb stages={[...props.stages]} onOpenMessage={props.onOpenMessage} /> : null}
      {source === 'drive' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {service && target ? (
              <ServiceDriveWeb target={target} service={service} onBack={() => setService(null)} />
            ) : (
              <>
                {props.client.drive_url ? <ClientDriveLink url={props.client.drive_url} /> : null}
                <ServicePicker client={props.client} canAsk={Boolean(target)} onPick={setService} />
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

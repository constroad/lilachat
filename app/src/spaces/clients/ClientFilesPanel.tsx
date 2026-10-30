import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronRight, ExternalLink, Folder, FolderOpen } from 'lucide-react-native';
import { stageFiles, type SpaceClient, type SpaceClientService, type WorkStage } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { StageFilesPanel } from '../../chat/workPlan/WorkListsPanels';
import { ServiceDrive } from './ServiceDrive';
import type { ServiceAskTarget } from './useServiceAsk';

type Source = 'channel' | 'drive';

function ClientDriveLink({ url }: { url: string }) {
  const colors = useColores();
  return (
    <Pressable testID="drive-cliente" onPress={() => void Linking.openURL(url)} className="min-h-[60px] flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface p-4">
      <FolderOpen size={22} color={colors.primary} />
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-on-surface">Drive del cliente</Text>
        <Text className="text-[12px] text-on-surface-variant">Todas sus carpetas en el Portal</Text>
      </View>
      <ExternalLink size={16} color={colors['on-surface-variant']} />
    </Pressable>
  );
}

/** One row per service; without the space (no way to ask), its Portal link. */
function ServicePicker(props: { client: SpaceClient; canAsk: boolean; onPick: (service: SpaceClientService) => void }) {
  const colors = useColores();
  if (!props.client.services.length) return <Text className="pt-6 text-center text-[14px] text-on-surface-variant">Este cliente todavía no tiene servicios.</Text>;
  return (
    <>
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Drive de cada servicio</Text>
      <View className="overflow-hidden rounded-xl border border-outline/15 bg-surface">
        {props.client.services.map((service) => (
          <Pressable key={service.id} testID={`drive-de-${service.id}`} disabled={!props.canAsk && !service.url} onPress={() => (props.canAsk ? props.onPick(service) : service.url && void Linking.openURL(service.url))} className="min-h-[56px] flex-row items-center gap-3 border-b border-outline/10 px-3">
            <Folder size={20} color={colors.primary} />
            <Text className="min-w-0 flex-1 text-[15px] font-semibold text-on-surface" numberOfLines={1}>{service.name}</Text>
            <ChevronRight size={16} color={colors['on-surface-variant']} />
          </Pressable>
        ))}
      </View>
    </>
  );
}

function SourceSwitch(props: { source: Source; channelFiles: number; onSource: (source: Source) => void }) {
  const options: { key: Source; label: string }[] = [
    { key: 'channel', label: props.channelFiles ? `Del canal · ${props.channelFiles}` : 'Del canal' },
    { key: 'drive', label: 'Drive del Portal' },
  ];
  return (
    <View className="mx-4 mt-3 flex-row gap-1 rounded-xl border border-outline/15 bg-surface p-1">
      {options.map((one) => (
        <Pressable key={one.key} testID={`archivos-${one.key}`} onPress={() => props.onSource(one.key)} accessibilityRole="tab" accessibilityState={{ selected: props.source === one.key }} className={`min-h-[40px] flex-1 items-center justify-center rounded-lg ${props.source === one.key ? 'bg-primary' : ''}`}>
          <Text className={`text-[14px] ${props.source === one.key ? 'font-semibold text-on-primary' : 'text-on-surface-variant'}`}>{one.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * «Archivos» of a client's channel, ONE tab (José asked for a single one on
 * 30/10): what was uploaded to the checklist («Del canal») and Portal's
 * Drive, per service. The Drive left «Servicios».
 */
export function ClientFilesPanel(props: { client: SpaceClient; target: ServiceAskTarget | null; stages: readonly WorkStage[]; onOpenMessage: (seq: number) => void }) {
  const channelFiles = stageFiles(props.stages).total;
  const [source, setSource] = useState<Source>(channelFiles ? 'channel' : 'drive');
  const [service, setService] = useState<SpaceClientService | null>(null);
  const { target } = props;
  return (
    <View testID="archivos-cliente" className="flex-1">
      <SourceSwitch source={source} channelFiles={channelFiles} onSource={setSource} />
      {source === 'channel' ? <StageFilesPanel stages={props.stages} onOpenMessage={props.onOpenMessage} /> : null}
      {source === 'drive' ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          {service && target ? (
            <ServiceDrive target={target} service={service} onBack={() => setService(null)} />
          ) : (
            <>
              {props.client.drive_url ? <ClientDriveLink url={props.client.drive_url} /> : null}
              <ServicePicker client={props.client} canAsk={Boolean(target)} onPick={setService} />
            </>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

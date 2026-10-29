import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Archive, ExternalLink } from 'lucide-react-native';
import { archivedBanner, ARCHIVED_COMPOSER_NOTE, CLIENT_SERVICE_STATUS_LABELS, type ClientServiceStatus, type SpaceClient } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

/** The parts of a client's channel (design f-03): the archived banner, the note over the composer and «Servicios». */
export function ArchivedClientBanner(props: { client: SpaceClient }) {
  const colors = useColores();
  const banner = archivedBanner(props.client);
  if (!banner) return null;
  return (
    <View testID="aviso-cliente-archivado" className="flex-row gap-3 border-b border-outline/10 bg-surface-variant px-4 py-3">
      <Archive size={20} color={colors['on-surface-variant']} />
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-bold text-on-surface">{banner.title}</Text>
        <Text className="text-[13px] text-on-surface-variant">{banner.body}</Text>
      </View>
    </View>
  );
}

export function ArchivedComposerNote(props: { client: SpaceClient | null }) {
  return props.client && !props.client.live ? <Text testID="nota-archivado" className="bg-background pt-2 text-center text-[13px] text-on-surface-variant">{ARCHIVED_COMPOSER_NOTE}</Text> : null;
}

const STATUS_TONE: Record<ClientServiceStatus, string> = {
  pending: 'border-warning/30 bg-warning/10 text-warning',
  in_progress: 'border-primary/30 bg-primary/10 text-primary',
  completed: 'border-en-linea/30 bg-en-linea/10 text-en-linea',
  rejected: 'border-error/30 bg-error/10 text-error',
};

/** «Servicios»: each service with its state, its progress (the client portal's) and «Ver en el Drive». */
export function ClientServices(props: { client: SpaceClient }) {
  const colors = useColores();
  const { services } = props.client;
  return (
    <ScrollView testID="servicios-cliente" contentContainerStyle={{ padding: 16, gap: 12 }}>
      {services.length === 0 ? <Text className="pt-10 text-center text-[14px] text-on-surface-variant">Este cliente todavía no tiene servicios.</Text> : null}
      {services.map((service) => (
        <View key={service.id} testID={`servicio-${service.id}`} className="rounded-2xl border border-outline/15 bg-surface p-4">
          <View className="flex-row items-start gap-3">
            <Text className="flex-1 text-[15px] font-semibold text-on-surface">{service.name}</Text>
            <Text className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{service.stage_label || CLIENT_SERVICE_STATUS_LABELS[service.status]}</Text>
          </View>
          {service.progress !== undefined ? (
            <View className="mt-3 flex-row items-center gap-3">
              <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-background"><View className="h-full rounded-full bg-primary" style={{ width: `${service.progress}%` }} /></View>
              <Text className="text-[12px] font-semibold text-on-surface-variant">{`${service.progress} %`}</Text>
            </View>
          ) : null}
          {service.url ? (
            <Pressable testID={`servicio-drive-${service.id}`} onPress={() => service.url && void Linking.openURL(service.url)} className="mt-3 min-h-[44px] flex-row items-center gap-1.5">
              <ExternalLink size={16} color={colors.primary} />
              <Text className="text-[14px] font-semibold text-primary">Ver en el Drive</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

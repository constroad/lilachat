import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Archive, ExternalLink, FileText, FolderOpen, Search } from 'lucide-react-native';
import { archivedBanner, ARCHIVED_COMPOSER_NOTE, CLIENT_SERVICE_STATUS_LABELS, filterServices, recordsByService, SERVICE_FILTER_LABELS, shortDate, type ServiceFilter, type ClientRecord, type ClientServiceStatus, type SpaceClient } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { ServiceDriveScreen } from './ServiceDriveScreen';

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

/**
 * «Servicios»: the client's Drive on top (José, 29/10), then each service with
 * its state, its progress, «Ver en el Drive» and its records (informes,
 * quotes, payments) — tapping one goes to its message in the chat.
 */
export function ClientServices(props: { client: SpaceClient; records: ClientRecord[] | null; onOpenRecord: (seq: number) => void; drive?: { jwt: string; spaceId: string } }) {
  const [driveOf, setDriveOf] = useState<{ id: string; name: string } | null>(null);
  const colors = useColores();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ServiceFilter>('all');
  const { services, counts } = filterServices(props.client.services, { query, filter });
  const grouped = props.records ? recordsByService(props.records) : null;
  const driveUrl = props.client.drive_url;
  return (
    <ScrollView testID="servicios-cliente" contentContainerStyle={{ padding: 16, gap: 12 }}>
      {driveUrl ? (
        <Pressable testID="drive-cliente" onPress={() => void Linking.openURL(driveUrl)} className="min-h-[60px] flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface p-4">
          <FolderOpen size={22} color={colors.primary} />
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-semibold text-on-surface">Drive del cliente</Text>
            <Text className="text-[12px] text-on-surface-variant">Todas sus carpetas en el Portal</Text>
          </View>
          <ExternalLink size={16} color={colors['on-surface-variant']} />
        </Pressable>
      ) : null}
      {props.client.services.length > 1 ? (
        <View className="gap-2">
          <View className="h-11 flex-row items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3">
            <Search size={16} color={colors['on-surface-variant']} />
            <TextInput testID="buscar-servicio" value={query} onChangeText={setQuery} placeholder="Buscar servicio" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[14px] text-on-surface" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(Object.keys(SERVICE_FILTER_LABELS) as ServiceFilter[]).map((key) => (
              <Pressable key={key} testID={`filtro-servicio-${key}`} onPress={() => setFilter(key)} accessibilityState={{ selected: filter === key }} className={`min-h-[36px] flex-row items-center gap-1.5 rounded-full border px-3 ${filter === key ? 'border-primary bg-primary' : 'border-outline/20 bg-surface'}`}>
                <Text className={`text-[13px] font-semibold ${filter === key ? 'text-on-primary' : 'text-on-surface-variant'}`}>{`${SERVICE_FILTER_LABELS[key]} · ${counts[key]}`}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {props.client.services.length === 0 ? <Text className="pt-10 text-center text-[14px] text-on-surface-variant">Este cliente todavía no tiene servicios.</Text> : null}
      {props.client.services.length > 0 && services.length === 0 ? <Text className="pt-6 text-center text-[14px] text-on-surface-variant">Ningún servicio con ese filtro.</Text> : null}
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
          {props.drive ? (
            <Pressable testID={`servicio-drive-${service.id}`} onPress={() => setDriveOf({ id: service.id, name: service.name })} className="mt-3 min-h-[44px] flex-row items-center gap-1.5">
              <FolderOpen size={16} color={colors.primary} />
              <Text className="text-[14px] font-semibold text-primary">Drive del servicio</Text>
            </Pressable>
          ) : service.url ? (
            <Pressable testID={`servicio-drive-${service.id}`} onPress={() => service.url && void Linking.openURL(service.url)} className="mt-3 min-h-[44px] flex-row items-center gap-1.5">
              <ExternalLink size={16} color={colors.primary} />
              <Text className="text-[14px] font-semibold text-primary">Ver en el Drive</Text>
            </Pressable>
          ) : null}
          <ServiceRecords records={grouped ? (grouped.get(service.id) ?? []) : null} onOpen={props.onOpenRecord} />
        </View>
      ))}
      {props.drive ? <ServiceDriveScreen jwt={props.drive.jwt} spaceId={props.drive.spaceId} clientId={props.client.id} service={driveOf} onClose={() => setDriveOf(null)} /> : null}
    </ScrollView>
  );
}

function ServiceRecords(props: { records: ClientRecord[] | null; onOpen: (seq: number) => void }) {
  const colors = useColores();
  if (props.records === null) return <View className="mt-3 h-8 rounded-lg bg-background" />;
  if (props.records.length === 0) return null;
  return (
    <View className="mt-3 border-t border-outline/10">
      {props.records.map((record) => (
        <Pressable key={record.seq} testID={`registro-${record.seq}`} onPress={() => props.onOpen(record.seq)} className="min-h-[48px] flex-row items-center gap-2.5 border-b border-outline/10 py-2">
          <FileText size={16} color={colors['on-surface-variant']} />
          <View className="min-w-0 flex-1">
            {record.kicker ? <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{record.kicker}</Text> : null}
            <Text numberOfLines={1} className="text-[14px] text-on-surface">{record.title}</Text>
          </View>
          <Text className="text-[11px] text-on-surface-variant">{shortDate(record.at)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

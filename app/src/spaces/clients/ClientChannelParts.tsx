import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Archive, ChevronRight, ExternalLink, FileText, Link2, Search, Share2 } from 'lucide-react-native';
import { archivedBanner, ARCHIVED_COMPOSER_NOTE, CLIENT_SERVICE_STATUS_LABELS, filterServices, recordsByService, SERVICE_FILTER_LABELS, dayOf, shortDate, type ChannelLinks, type ServiceFilter, type ClientRecord, type SpaceClient, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { ClientAccessRow } from './ClientAccess';
import { ServiceDetailView } from './ServiceDetailView';
import { STATUS_TONE } from './tones';
import type { ServiceAskTarget } from './useServiceAsk';

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

function ServiceFilters(props: { query: string; onQuery: (query: string) => void; filter: ServiceFilter; onFilter: (filter: ServiceFilter) => void; counts: Record<ServiceFilter, number> }) {
  const colors = useColores();
  return (
    <View className="gap-2">
      <View className="h-11 flex-row items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3">
        <Search size={16} color={colors['on-surface-variant']} />
        <TextInput testID="buscar-servicio" value={props.query} onChangeText={props.onQuery} placeholder="Buscar servicio" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[14px] text-on-surface" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(Object.keys(SERVICE_FILTER_LABELS) as ServiceFilter[]).map((key) => (
          <Pressable key={key} testID={`filtro-servicio-${key}`} onPress={() => props.onFilter(key)} accessibilityState={{ selected: props.filter === key }} className={`min-h-[36px] flex-row items-center gap-1.5 rounded-full border px-3 ${props.filter === key ? 'border-primary bg-primary' : 'border-outline/20 bg-surface'}`}>
            <Text className={`text-[13px] font-semibold ${props.filter === key ? 'text-on-primary' : 'text-on-surface-variant'}`}>{`${SERVICE_FILTER_LABELS[key]} · ${props.counts[key]}`}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Tapping the head opens its expediente; without the space (no way to ask), its Portal link. «Compartir» makes its link (José 31/10). */
function ServiceCard(props: { service: SpaceClientService; records: ClientRecord[] | null; canOpen: boolean; onOpen: () => void; onOpenRecord: (seq: number) => void; onShare?: () => void }) {
  const colors = useColores();
  const { service } = props;
  const action = props.canOpen ? props.onOpen : service.url ? () => service.url && void Linking.openURL(service.url) : undefined;
  return (
    <View testID={`servicio-${service.id}`} className="rounded-2xl border border-outline/15 bg-surface p-4">
      <Pressable testID={`abrir-servicio-${service.id}`} disabled={!action} onPress={action}>
        <View className="flex-row items-start gap-3">
          <Text className="flex-1 text-[15px] font-semibold text-on-surface">{service.name}</Text>
          <Text className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{service.stage_label || CLIENT_SERVICE_STATUS_LABELS[service.status]}</Text>
        </View>
        {/* José 31/10: «la lista de servicios no muestra la fecha». */}
        {service.started_at ? <Text testID={`inicio-servicio-${service.id}`} className="mt-1 text-[12px] text-on-surface-variant">{`Inicio ${dayOf(service.started_at)}`}</Text> : null}
        {service.progress !== undefined ? (
          <View className="mt-3 flex-row items-center gap-3">
            <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-background"><View className="h-full rounded-full bg-primary" style={{ width: `${service.progress}%` }} /></View>
            <Text className="text-[12px] font-semibold text-on-surface-variant">{`${service.progress} %`}</Text>
          </View>
        ) : null}
        {action ? (
          <View className="mt-3 min-h-[36px] flex-row items-center gap-1.5">
            <Text className="text-[14px] font-semibold text-primary">{props.canOpen ? 'Pedidos, despachos e informes' : 'Ver en el Portal'}</Text>
            {props.canOpen ? <ChevronRight size={16} color={colors.primary} /> : <ExternalLink size={15} color={colors.primary} />}
          </View>
        ) : null}
      </Pressable>
      {props.onShare ? (
        <Pressable testID={`compartir-servicio-${service.id}`} onPress={props.onShare} className="mt-2 min-h-[40px] flex-row items-center gap-1.5 self-start rounded-lg border border-outline/20 px-3">
          <Share2 size={15} color={colors.primary} />
          <Text className="text-[13px] font-semibold text-primary">Compartir</Text>
        </Pressable>
      ) : null}
      <ServiceRecords records={props.records} onOpen={props.onOpenRecord} />
    </View>
  );
}

/**
 * «Servicios»: each service with its state, its progress and its records
 * (informes, quotes, payments) — tapping one goes to its message in the chat.
 * Tapping the service opens its expediente (José, 30/10); the Drive moved to
 * «Archivos».
 */
export function ClientServices(props: { client: SpaceClient; records: ClientRecord[] | null; onOpenRecord: (seq: number) => void; target: ServiceAskTarget | null; members: ReadonlyMap<string, string>; me: string; links?: ChannelLinks }) {
  const colors = useColores();
  const { links } = props;
  const clientId = props.client.id;
  const [opened, setOpened] = useState<SpaceClientService | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ServiceFilter>('all');
  const close = useCallback(() => setOpened(null), []);
  const { services, counts } = filterServices(props.client.services, { query, filter });
  const grouped = props.records ? recordsByService(props.records) : null;
  if (opened && props.target) return <ServiceDetailView target={props.target} service={opened} onBack={close} links={links} />;
  const total = props.client.services.length;
  return (
    <ScrollView testID="servicios-cliente" contentContainerStyle={{ padding: 16, gap: 12 }}>
      {props.target ? <ClientAccessRow target={props.target} members={props.members} me={props.me} chatId={props.client.chat_id} /> : null}
      {/* José 31/10: the client's link here; an order's in its sheet, a service's on its card. */}
      {links?.can('client') ? (
        <Pressable testID="enlace-cliente" onPress={() => links.open({ kind: 'client', clientId })} className="min-h-[44px] flex-row items-center gap-2 self-start rounded-xl border border-primary/30 bg-primary/10 px-3">
          <Link2 size={16} color={colors.primary} />
          <Text className="text-[14px] font-semibold text-primary">Enlace del cliente</Text>
        </Pressable>
      ) : null}
      {total > 1 ? <ServiceFilters query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} counts={counts} /> : null}
      {total === 0 ? <Text className="pt-10 text-center text-[14px] text-on-surface-variant">Este cliente todavía no tiene servicios.</Text> : null}
      {total > 0 && services.length === 0 ? <Text className="pt-6 text-center text-[14px] text-on-surface-variant">Ningún servicio con ese filtro.</Text> : null}
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} records={grouped ? (grouped.get(service.id) ?? []) : null} canOpen={Boolean(props.target)} onOpen={() => setOpened(service)} onOpenRecord={props.onOpenRecord} onShare={links?.can('service') ? () => links.open({ kind: 'service', clientId, serviceId: service.id }) : undefined} />
      ))}
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

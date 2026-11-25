import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AlertCircle, Archive, ChevronRight, FolderOpen, Link2, Search } from 'lucide-react-native';
import { archivedBanner, ARCHIVED_COMPOSER_NOTE, filterServices, pendingPreview, serviceAccessOf, serviceSegmentsOf, orderFocusOf, type ChannelLinks, type ServiceFilter, type ClientRecord, type SpaceClient, type SpaceClientService, type WorkStage } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { ClientAccessRow } from './ClientAccess';
import { ServiceDetailView } from './ServiceDetailView';
import { ServiceCard } from './ServiceCard';
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
      {/* Design cc-01: a segmented control, «Rechazados» only when there is one. */}
      <View className="flex-row rounded-xl border border-outline/15 bg-surface p-1">
        {serviceSegmentsOf(props.counts).map((one) => (
          <Pressable key={one.key} testID={`filtro-servicio-${one.key}`} onPress={() => props.onFilter(one.key)} accessibilityRole="button" accessibilityState={{ selected: props.filter === one.key }} className={`min-h-[40px] flex-1 items-center justify-center rounded-lg ${props.filter === one.key ? 'bg-primary' : ''}`}>
            <Text numberOfLines={1} className={`text-[13px] font-semibold ${props.filter === one.key ? 'text-on-primary' : 'text-on-surface-variant'}`}>{`${one.label} ${one.count}`}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** The plan's stages and the way to them: only on a phone (design cc-01 mobile). */
export type ChannelPending = { stages: readonly WorkStage[]; /** «Ver en Checklist», or «Ver pendientes» for whoever has no checklist. */ label: string; onOpen: () => void };

/** Design cc-01 mobile: the open tasks over the list. */
function PendingBlock(props: { pending: ChannelPending; nameOf: (userId: string) => string }) {
  const colors = useColores();
  const { tasks, total } = pendingPreview(props.pending.stages, new Date());
  if (!total) return null;
  return (
    <View testID="servicios-pendientes" className="rounded-2xl border border-outline/15 border-t-[3px] border-t-warning bg-surface p-3">
      <View className="flex-row items-center justify-between pb-2">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-warning">{`Pendientes · ${total}`}</Text>
        <Pressable testID="ver-en-checklist" onPress={props.pending.onOpen} className="min-h-[40px] flex-row items-center gap-0.5">
          <Text className="text-[13px] font-semibold text-primary">{props.pending.label}</Text>
          <ChevronRight size={14} color={colors.primary} />
        </Pressable>
      </View>
      {tasks.map((task) => (
        <View key={`${task.stageId}-${task.item.id}`} className="mt-1.5 flex-row items-start gap-2 rounded-xl border border-warning/25 bg-warning/5 px-3 py-2">
          <AlertCircle size={16} color={colors.warning} />
          <View className="min-w-0 flex-1">
            <Text className="text-[14px] font-semibold text-on-surface">{task.item.text}</Text>
            <Text className="text-[12px] text-on-surface-variant">{task.item.assignee ? `Etapa ${task.stage} · ${props.nameOf(task.item.assignee)}` : `Etapa ${task.stage}`}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ListHead(props: { client: SpaceClient; links?: ChannelLinks; seesDrive: boolean }) {
  const colors = useColores();
  const { links } = props;
  const driveUrl = props.client.drive_url;
  return (
    <View className="gap-2">
      <View>
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Servicios del cliente</Text>
        <Text className="text-[22px] font-extrabold text-primary">Servicios</Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {/* José 31/10: the client's link here; an order's in its sheet, a service's on its card. */}
        {links?.can('client') ? (
          <Pressable testID="enlace-cliente" onPress={() => links.open({ kind: 'client', clientId: props.client.id })} className={HEAD_BUTTON}>
            <Link2 size={16} color={colors.primary} />
            <Text className="text-[14px] font-semibold text-on-surface">Enlace del cliente</Text>
          </Pressable>
        ) : null}
        {props.seesDrive && driveUrl ? (
          <Pressable testID="drive-cliente" onPress={() => void Linking.openURL(driveUrl)} className={HEAD_BUTTON}>
            <FolderOpen size={16} color={colors.primary} />
            <Text className="text-[14px] font-semibold text-on-surface">Drive del cliente</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const HEAD_BUTTON = 'min-h-[44px] flex-row items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3';

/**
 * «Servicios» (José 19/11, design cc-01): the client's link and Drive, the search with «Abiertos ·
 * Completados · Todos» and a card per service; on a phone the open tasks go first. The service opens
 * under the channel's tabs (tablet) or over the whole screen (phone).
 */
export function ClientServices(props: { /** The channel hides its chrome while a service is open on a phone. */ onServiceOpen?: (open: boolean) => void; client: SpaceClient; records: ClientRecord[] | null; target: ServiceAskTarget | null; members: ReadonlyMap<string, string>; me: string; links?: ChannelLinks; /** The message of the order's card that sent here. */ focusSeq?: number | null; onFocused?: () => void; /** A card's `open: { route: 'service' }` (agentes, 20/11): the service to open directly, no order lookup. */ focusServiceId?: string | null; /** With it, an «INFORME» card's report opens on Informes (José 25/11). */ focusReportId?: string | null; onServiceFocused?: () => void; pending?: ChannelPending; compact?: boolean }) {
  const { links } = props;
  const clientId = props.client.id;
  const [opened, setOpened] = useState<SpaceClientService | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ServiceFilter>('all');
  const [startReportId, setStartReportId] = useState<string | undefined>();
  const close = useCallback(() => { setOpened(null); setStartReportId(undefined); }, []);
  const [startOrderId, setStartOrderId] = useState<string | undefined>(); // gates-allow: duplicate (React state twin of the web ClientServices; shared has no React, the logic lives in orderFocusOf)
  const { focusSeq, records, onFocused, focusServiceId, focusReportId, onServiceFocused } = props;
  const clientServices = props.client.services;
  // The records say which order the card was: until they arrive, this waits.
  useEffect(() => {
    if (focusSeq === null || focusSeq === undefined || !records) return;
    const focus = orderFocusOf(clientServices, records, focusSeq);
    if (focus) { setStartOrderId(focus.orderId); setOpened(focus.service); } // gates-allow: duplicate (React state twin of the web ClientServices; shared has no React, the logic lives in orderFocusOf)
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
    onServiceOpen?.(showsDetail); // gates-allow: duplicate (React state twin of the web ClientServices; shared has no React, the logic lives in orderFocusOf)
    return () => onServiceOpen?.(false);
  }, [showsDetail, onServiceOpen]);
  const { services, counts } = filterServices(props.client.services, { query, filter });
  const sees = serviceAccessOf(props.client.access);
  if (opened && props.target) return <ServiceDetailView key={`${opened.id}:${startReportId ?? ''}`} people={[...props.members.values()]} target={props.target} chatId={props.client.chat_id} clientName={props.client.name} compact={props.compact ?? true} service={opened} seesMoney={Boolean(props.client.access?.money)} admin={Boolean(props.client.access?.admin)} seesDrive={sees.drive} driveOnly={!sees.detail} onBack={close} links={links} startOrderId={startOrderId} startReportId={startReportId} />;
  const total = props.client.services.length;
  const nameOf = (userId: string) => props.members.get(userId) ?? 'Alguien';
  return (
    <ScrollView keyboardShouldPersistTaps="handled" testID="servicios-cliente" contentContainerStyle={{ padding: 16, gap: 12 }}>
      {props.pending ? <PendingBlock pending={props.pending} nameOf={nameOf} /> : null}
      <ListHead client={props.client} links={links} seesDrive={sees.drive} />
      {props.target ? <ClientAccessRow target={props.target} members={props.members} me={props.me} /> : null}
      {total > 1 ? <ServiceFilters query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} counts={counts} /> : null}
      {total === 0 ? <Text className="pt-10 text-center text-[14px] text-on-surface-variant">Este cliente todavía no tiene servicios.</Text> : null}
      {total > 0 && services.length === 0 ? <Text className="pt-6 text-center text-[14px] text-on-surface-variant">Ningún servicio con ese filtro.</Text> : null}
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} canOpen={Boolean(props.target)} onOpen={() => setOpened(service)} onShare={links?.can('service') ? () => links.open({ kind: 'service', clientId, serviceId: service.id }) : undefined} />
      ))}
    </ScrollView>
  );
}

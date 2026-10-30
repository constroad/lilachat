import { useEffect, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronLeft, ExternalLink, FileText } from 'lucide-react-native';
import { CLIENT_SERVICE_STATUS_LABELS, DETAIL_EMPTY, detailRows, detailTabs, moreInPortal, type DetailRow, type DetailTabKey, type ServiceDetail, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { DETAIL_TONE, STATUS_TONE } from './tones';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';

const open = (url?: string | null) => {
  if (url) void Linking.openURL(url);
};

function PortalLink(props: { url: string; label: string; testID: string }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} onPress={() => open(props.url)} className="min-h-[44px] flex-row items-center gap-1.5">
      <ExternalLink size={15} color={colors.primary} />
      <Text className="text-[14px] font-semibold text-primary">{props.label}</Text>
    </Pressable>
  );
}

/** The expediente's head (design f-04): kicker, name, state and stage with its progress. */
export function ServiceHead({ service }: { service: SpaceClientService }) {
  return (
    <View className="rounded-2xl border border-outline/15 border-t-[3px] border-t-primary bg-surface p-4">
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Servicio</Text>
          <Text className="mt-1 text-[18px] font-bold text-on-surface">{service.name}</Text>
        </View>
        <Text className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{CLIENT_SERVICE_STATUS_LABELS[service.status]}</Text>
      </View>
      {service.stage_label || service.progress !== undefined ? (
        <View className="mt-3 border-t border-outline/10 pt-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] text-on-surface">{service.stage_label ? `Etapa: ${service.stage_label}` : 'Avance'}</Text>
            {service.progress !== undefined ? <Text className="text-[14px] font-bold text-on-surface">{`${service.progress} %`}</Text> : null}
          </View>
          {service.progress !== undefined ? <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><View className="h-full rounded-full bg-primary" style={{ width: `${service.progress}%` }} /></View> : null}
        </View>
      ) : null}
    </View>
  );
}

function RowView({ row }: { row: DetailRow }) {
  const colors = useColores();
  return (
    <Pressable testID={`fila-${row.id}`} disabled={!row.url} onPress={() => open(row.url)} className="min-h-[60px] flex-row items-center gap-3 border-b border-outline/10 px-3 py-2.5">
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-semibold text-on-surface" numberOfLines={1}>{row.title}</Text>
        {row.line ? <Text className="mt-0.5 text-[12px] text-on-surface-variant" numberOfLines={1}>{row.line}</Text> : null}
        {row.file ? (
          <Pressable testID={`archivo-${row.id}`} onPress={() => open(row.file?.url)} className="mt-1 min-h-[32px] flex-row items-center gap-1">
            <FileText size={14} color={colors.primary} />
            <Text className="text-[13px] font-semibold text-primary">{row.file.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[row.status.tone]}`}>{row.status.label}</Text>
    </Pressable>
  );
}

function DetailTabs({ detail }: { detail: ServiceDetail }) {
  const [tab, setTab] = useState<DetailTabKey>('orders');
  const rows = detailRows(detail, tab);
  const more = moreInPortal(rows.length, detail.totals[tab] ?? rows.length);
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} className="flex-grow-0 rounded-xl border border-outline/15 bg-surface p-1">
        {detailTabs(detail).map((one) => (
          <Pressable key={one.key} testID={`pestana-detalle-${one.key}`} onPress={() => setTab(one.key)} accessibilityRole="tab" accessibilityState={{ selected: tab === one.key }} className={`min-h-[40px] justify-center rounded-lg px-3 ${tab === one.key ? 'bg-primary' : ''}`}>
            <Text className={`text-[14px] ${tab === one.key ? 'font-semibold text-on-primary' : 'text-on-surface-variant'}`}>{one.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
        {rows.length ? rows.map((row) => <RowView key={row.id} row={row} />) : <Text className="p-4 text-[14px] text-on-surface-variant">{DETAIL_EMPTY[tab]}</Text>}
      </View>
      {more ? <Text className="text-center text-[12px] text-on-surface-variant">{`${more} · el resto está en el Portal`}</Text> : null}
      {detail.service.url ? <PortalLink url={detail.service.url} label="Abrir en el Portal" testID="abrir-servicio-portal" /> : null}
    </>
  );
}

const Skeleton = () => (
  <View testID="detalle-cargando" className="gap-2">
    <View className="h-11 rounded-xl bg-surface-variant" />
    <View className="h-40 rounded-2xl bg-surface-variant" />
  </View>
);

/**
 * A client's service as an expediente (José 30/10: «no veo cómo navegar en el
 * servicio, qué informes, qué pedidos, qué despachos»; design f-04): its head,
 * then Pedidos · Despachos · Informes with Portal's counts. Asked when it opens.
 */
export function ServiceDetailView(props: { target: ServiceAskTarget; service: SpaceClientService; onBack: () => void }) {
  const colors = useColores();
  const answer = useServiceAsk('detail', props.target, props.service.id);
  const { onBack } = props;
  // Android's BACK goes back to the list; the last listener added runs first.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);
  return (
    <ScrollView testID="detalle-servicio" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Pressable testID="volver-a-servicios" onPress={onBack} className="min-h-[40px] flex-row items-center gap-1 self-start">
        <ChevronLeft size={18} color={colors.primary} />
        <Text className="text-[14px] font-semibold text-primary">Servicios</Text>
      </Pressable>
      <ServiceHead service={props.service} />
      {answer === null ? <Skeleton /> : null}
      {answer?.ok ? <DetailTabs detail={answer.value} /> : null}
      {answer && !answer.ok ? (
        <View testID="detalle-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
          <Text className="text-[15px] font-semibold text-on-surface">{answer.message}</Text>
          {answer.portalUrl ? <PortalLink url={answer.portalUrl} label="Abrir el servicio en el Portal" testID="detalle-fallo-portal" /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

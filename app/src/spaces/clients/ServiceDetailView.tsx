import { useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronLeft, ExternalLink, FileText } from 'lucide-react-native';
import { CLIENT_SERVICE_STATUS_LABELS, DETAIL_EMPTY, serviceStageLine, detailRows, detailSheet, detailTabs, moreInPortal, type DetailRow, type DetailTabKey, type ServiceDetail, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import type { ViewableFile } from './fileViewer';
import { RecordSheet } from './RecordSheet';
import { ServiceBilling } from './ServiceBilling';
import { DETAIL_TONE, STATUS_TONE } from './tones';
import { useFileViewer } from './useFileViewer';
import { useReportPdf } from './useReportPdf';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';

/** How much of the previous tab stays visible when one scrolls into view. */
const TAB_SCROLL_MARGIN = 24;

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
            <Text className="text-[14px] text-on-surface">{serviceStageLine(service)}</Text>
            {service.progress !== undefined ? <Text className="text-[14px] font-bold text-on-surface">{`${service.progress} %`}</Text> : null}
          </View>
          {service.progress !== undefined ? <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><View className="h-full rounded-full bg-primary" style={{ width: `${service.progress}%` }} /></View> : null}
        </View>
      ) : null}
    </View>
  );
}

function RowView({ row, onOpen, onOpenFile }: { row: DetailRow; onOpen: (id: string) => void; onOpenFile: (file: ViewableFile) => void }) {
  const colors = useColores();
  const file = row.file;
  return (
    <Pressable testID={`fila-${row.id}`} onPress={() => onOpen(row.id)} className="min-h-[60px] flex-row items-center gap-3 border-b border-outline/10 px-3 py-2.5">
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-semibold text-on-surface" numberOfLines={1}>{row.title}</Text>
        {row.line ? <Text className="mt-0.5 text-[12px] text-on-surface-variant" numberOfLines={1}>{row.line}</Text> : null}
        {file ? (
          <Pressable testID={`archivo-${row.id}`} onPress={() => onOpenFile({ url: file.url, name: `${row.title} · ${file.label}` })} className="mt-1 min-h-[32px] flex-row items-center gap-1">
            <FileText size={14} color={colors.primary} />
            <Text className="text-[13px] font-semibold text-primary">{file.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[row.status.tone]}`}>{row.status.label}</Text>
    </Pressable>
  );
}

/** The tabs scroll so the one touched is whole on screen (30/10: «Cotizaciones» showed as a cut «C»). */
function TabStrip(props: { detail: ServiceDetail; tab: DetailTabKey; onTab: (tab: DetailTabKey) => void }) {
  const strip = useRef<ScrollView>(null);
  const starts = useRef<Partial<Record<DetailTabKey, number>>>({});
  const pick = (key: DetailTabKey) => {
    props.onTab(key);
    strip.current?.scrollTo({ x: Math.max(0, (starts.current[key] ?? 0) - TAB_SCROLL_MARGIN), animated: true });
  };
  return (
    <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} className="flex-grow-0 rounded-xl border border-outline/15 bg-surface p-1">
      {detailTabs(props.detail).map((one) => (
        <Pressable key={one.key} testID={`pestana-detalle-${one.key}`} onLayout={(event) => (starts.current[one.key] = event.nativeEvent.layout.x)} onPress={() => pick(one.key)} accessibilityRole="tab" accessibilityState={{ selected: props.tab === one.key }} className={`min-h-[40px] justify-center rounded-lg px-3 ${props.tab === one.key ? 'bg-primary' : ''}`}>
          <Text className={`text-[14px] ${props.tab === one.key ? 'font-semibold text-on-primary' : 'text-on-surface-variant'}`}>{one.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function DetailTabs({ detail, target, serviceId, onOpenFile }: { detail: ServiceDetail; target: ServiceAskTarget; serviceId: string; onOpenFile: (file: ViewableFile) => void }) {
  const [tab, setTab] = useState<DetailTabKey>('orders');
  const [openId, setOpenId] = useState<string | null>(null);
  const reportPdf = useReportPdf(target, serviceId, onOpenFile);
  const sheet = openId ? detailSheet(detail, tab, openId) : null;
  const close = () => {
    reportPdf.stop();
    setOpenId(null);
  };
  const rows = detailRows(detail, tab);
  const more = tab === 'billing' ? null : moreInPortal(rows.length, detail.totals[tab] ?? rows.length);
  return (
    <>
      <TabStrip detail={detail} tab={tab} onTab={setTab} />
      {tab === 'billing' && detail.billing ? <ServiceBilling billing={detail.billing} onOpenFile={onOpenFile} /> : (
        <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
          {rows.length ? rows.map((row) => <RowView key={row.id} row={row} onOpen={setOpenId} onOpenFile={onOpenFile} />) : <Text className="p-4 text-[14px] text-on-surface-variant">{DETAIL_EMPTY[tab]}</Text>}
        </View>
      )}
      {more ? <Text className="text-center text-[12px] text-on-surface-variant">{`${more} · el resto está en el Portal`}</Text> : null}
      <RecordSheet sheet={sheet} onClose={close} onOpenFile={onOpenFile} pdf={sheet?.pdfOnDemand ? { asking: reportPdf.asking, message: reportPdf.message, onAsk: () => void reportPdf.ask(sheet.pdfOnDemand!, `${sheet.title} · PDF`) } : undefined} />
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
 * A client's service as an expediente (José 30/10: there was no way to see a
 * service's reports, orders and dispatches; design f-04): its head, then
 * Pedidos · Despachos · Informes with Portal's counts. Asked when it opens.
 */
export function ServiceDetailView(props: { target: ServiceAskTarget; service: SpaceClientService; onBack: () => void }) {
  const colors = useColores();
  const answer = useServiceAsk('detail', props.target, props.service.id);
  const files = useFileViewer();
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
      {answer?.ok ? <DetailTabs detail={answer.value} target={props.target} serviceId={props.service.id} onOpenFile={files.open} /> : null}
      {files.notice ? <Text className="text-center text-[13px] text-error">{files.notice}</Text> : null}
      {files.viewer}
      {answer && !answer.ok ? (
        <View testID="detalle-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
          <Text className="text-[15px] font-semibold text-on-surface">{answer.message}</Text>
          {answer.portalUrl ? <PortalLink url={answer.portalUrl} label="Abrir el servicio en el Portal" testID="detalle-fallo-portal" /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

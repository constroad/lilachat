import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronLeft, ExternalLink, FileText } from 'lucide-react-native';
import { CLIENT_SERVICE_STATUS_LABELS, DETAIL_EMPTY, serviceStageLine, detailRows, detailSheet, detailTabs, invoicesOf, moreInPortal, orphanDispatchesOf, reportGroups, type ChannelLinks, type DetailRow, type DetailTabKey, type ServiceDetail, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import type { ViewableFile } from '@lilachat/shared';
import { RecordSheet } from './RecordSheet';
import { RegisterPayment } from './RegisterPayment';
import { ServiceBilling } from './ServiceBilling';
import { ServiceStages } from './ServiceStages';
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
export function ServiceHead({ service, detail }: { service: SpaceClientService; detail?: ServiceDetail | null }) {
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
      {detail ? <ServiceStages detail={detail} /> : null}
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

/** The reports under a header per day, like Portal's list (José 31/10). */
function ReportDays({ detail, onOpen, onOpenFile }: { detail: ServiceDetail; onOpen: (id: string) => void; onOpenFile: (file: ViewableFile) => void }) {
  return (
    <>
      {reportGroups(detail).map((group) => (
        <View key={group.title} testID={`dia-informes-${group.title}`}>
          <Text className="bg-surface-variant/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[1.2px] text-on-surface-variant">{group.title}</Text>
          {group.rows.map((row) => <RowView key={row.id} row={row} onOpen={onOpen} onOpenFile={onOpenFile} />)}
        </View>
      ))}
    </>
  );
}

/** Dispatches whose order did not come in the 100 Portal sent (José 01/11: they live inside their order). */
function OrphanDispatches({ detail, onOpen, onOpenFile }: { detail: ServiceDetail; onOpen: (id: string) => void; onOpenFile: (file: ViewableFile) => void }) {
  const rows = orphanDispatchesOf(detail);
  if (!rows.length) return null;
  return (
    <View testID="despachos-sin-pedido" className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
      <Text className="bg-surface-variant/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[1.2px] text-on-surface-variant">Despachos de otros pedidos</Text>
      {rows.map((row) => <RowView key={row.id} row={row} onOpen={onOpen} onOpenFile={onOpenFile} />)}
    </View>
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

/** An order's sheet makes its link with what Portal's modal asks (José 31/10); other sheets have no button. */
type OpenSheet = { tab: DetailTabKey; id: string };
const orderLinkAction = (links: ChannelLinks | undefined, top: OpenSheet | undefined, target: ServiceAskTarget) =>
  links?.can('order') && top?.tab === 'orders' ? { label: 'Crear enlace del pedido', onPress: () => links.open({ kind: 'order', clientId: target.clientId, orderId: top.id }) } : undefined;

/** Above the tab (José 31/10): «Registrar pago» in Cobranza; «Generar informe de servicio» in Informes while Portal's tool exists. */
function TabActions({ tab, links, target, serviceId, onPaid }: { tab: DetailTabKey; links?: ChannelLinks; target: ServiceAskTarget; serviceId: string; onPaid: () => void }) {
  const colors = useColores();
  if (tab === 'billing') return <RegisterPayment jwt={target.jwt} spaceId={target.spaceId} serviceId={serviceId} onPaid={onPaid} />;
  if (tab !== 'reports' || !links?.can('serviceReport')) return null;
  return (
    <Pressable testID="generar-informe-servicio" onPress={() => links.open({ kind: 'serviceReport', clientId: target.clientId, serviceId })} className="min-h-[48px] flex-row items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3">
      <FileText size={18} color={colors.primary} />
      <Text className="flex-1 text-[15px] font-semibold text-primary">Generar informe de servicio</Text>
    </Pressable>
  );
}

function DetailTabs({ detail, target, serviceId, onOpenFile, links, onPaid }: { detail: ServiceDetail; target: ServiceAskTarget; serviceId: string; onOpenFile: (file: ViewableFile, siblings?: readonly ViewableFile[]) => void; links?: ChannelLinks; onPaid: () => void }) {
  // José 30/10 night: Cotizaciones and Cobranza first; it opens on the first one that came.
  const [tab, setTab] = useState<DetailTabKey>(() => detailTabs(detail)[0]?.key ?? 'orders');
  // An order's sheet opens its dispatches on top (José 01/11); closing goes back one.
  const [opened, setOpened] = useState<OpenSheet[]>([]);
  const reportPdf = useReportPdf(target, serviceId, onOpenFile);
  const top = opened.at(-1);
  const sheet = top ? detailSheet(detail, top.tab, top.id) : null;
  const openRow = (id: string) => setOpened([{ tab, id }]);
  const openDispatch = (id: string) => setOpened((before) => [...before, { tab: 'dispatches', id }]);
  const close = () => {
    reportPdf.stop();
    setOpened((before) => before.slice(0, -1));
  };
  const rows = detailRows(detail, tab);
  const more = tab === 'billing' ? null : moreInPortal(rows.length, detail.totals[tab] ?? rows.length);
  return (
    <>
      <TabStrip detail={detail} tab={tab} onTab={setTab} />
      <TabActions tab={tab} links={links} target={target} serviceId={serviceId} onPaid={onPaid} />
      {tab === 'billing' && detail.billing ? <ServiceBilling billing={detail.billing} invoices={invoicesOf(detail)} onOpenFile={onOpenFile} /> : (
        <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
          {!rows.length ? <Text className="p-4 text-[14px] text-on-surface-variant">{DETAIL_EMPTY[tab]}</Text> : tab === 'reports' ? <ReportDays detail={detail} onOpen={openRow} onOpenFile={onOpenFile} /> : rows.map((row) => <RowView key={row.id} row={row} onOpen={openRow} onOpenFile={onOpenFile} />)}
        </View>
      )}
      {tab === 'orders' ? <OrphanDispatches detail={detail} onOpen={openDispatch} onOpenFile={onOpenFile} /> : null}
      {more ? <Text className="text-center text-[12px] text-on-surface-variant">{`${more} · el resto está en el Portal`}</Text> : null}
      <RecordSheet sheet={sheet} onClose={close} onOpenFile={onOpenFile} pdf={sheet?.pdfOnDemand ? { asking: reportPdf.asking, message: reportPdf.message, onAsk: () => void reportPdf.ask(sheet.pdfOnDemand!, `${sheet.title} · PDF`) } : undefined} onOpenRelated={openDispatch} action={orderLinkAction(links, top, target)} />
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
 * Pedidos · Informes with Portal's counts, each order with its dispatches
 * inside (José 01/11). Asked when it opens.
 */
export function ServiceDetailView(props: { target: ServiceAskTarget; service: SpaceClientService; onBack: () => void; links?: ChannelLinks }) {
  const colors = useColores();
  // After a payment the detail is asked again, keeping the open tab (agentes 31/10).
  const [round, setRound] = useState(0);
  const askAgain = useCallback(() => setRound((count) => count + 1), []);
  const answer = useServiceAsk('detail', props.target, props.service.id, round);
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
      <ServiceHead service={props.service} detail={answer?.ok ? answer.value : null} />
      {answer === null ? <Skeleton /> : null}
      {answer?.ok ? <DetailTabs detail={answer.value} target={props.target} serviceId={props.service.id} onOpenFile={files.open} links={props.links} onPaid={askAgain} /> : null}
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

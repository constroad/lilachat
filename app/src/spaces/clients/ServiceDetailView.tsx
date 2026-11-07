import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, ExternalLink, FilePlus, FileText } from 'lucide-react-native';
import { draftToContinue, CLIENT_SERVICE_STATUS_LABELS, detailEmptyText, SERVICE_REPORT_ACTION, serviceStageLine, serviceValuesOf, detailRows, detailSheet, serviceTabs, openingSheets, moreInPortal, orphanDispatchesOf, reportGroups, type ChannelLinks, type DetailRow, type DetailTabKey, type ServiceTabKey, type ServiceDetail, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import type { ViewableFile } from '@lilachat/shared';
import { RecordSheet } from './RecordSheet';
import { ServiceDrive } from './ServiceDrive';
import { ServiceMapPanel } from './ServiceMapPanel';
import { workProgressSender } from './workMap/workProgressSender';
import { ServiceStages } from './ServiceStages';
import { SpaceActionButton } from './SpaceActionButton';
import { DETAIL_TONE, STATUS_TONE } from './tones';
import { useFileViewer } from './useFileViewer';
import { useReportPdf } from './useReportPdf';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';
import { CreateReportSheet } from './reports/CreateReportSheet';
import { ReportDocumentScreen } from './reports/ReportDocumentScreen';

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
/** The stages read quotes and collection: only a space admin sees them (José 07/11). */
export function ServiceHead({ service, detail, admin = false }: { service: SpaceClientService; detail?: ServiceDetail | null; admin?: boolean }) {
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
      {detail && admin ? <ServiceStages detail={detail} /> : null}
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
function TabStrip(props: { detail: ServiceDetail; seesDrive: boolean; seesMap: boolean; tab: ServiceTabKey; onTab: (tab: ServiceTabKey) => void }) {
  const strip = useRef<ScrollView>(null);
  const starts = useRef<Partial<Record<ServiceTabKey, number>>>({});
  const pick = (key: ServiceTabKey) => {
    props.onTab(key);
    strip.current?.scrollTo({ x: Math.max(0, (starts.current[key] ?? 0) - TAB_SCROLL_MARGIN), animated: true });
  };
  return (
    <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} className="flex-grow-0 rounded-xl border border-outline/15 bg-surface p-1">
      {serviceTabs(props.detail, props.seesDrive, props.seesMap).map((one) => (
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

/** «Crear informe» above Informes, for everyone with the services (José 05/11): the type picker, design j-01. */
function CreateReportButton({ onPress }: { onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID="crear-informe" onPress={onPress} className="min-h-[48px] flex-row items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3">
      <FilePlus size={18} color={colors.primary} />
      <Text className="flex-1 text-[15px] font-semibold text-primary">Crear informe</Text>
    </Pressable>
  );
}

/**
 * «Generar informe de servicio» above Informes (José 31/10): the liquidation
 * carries amounts, so only for whoever sees money (José 05/11). It runs from
 * the space (Portal refuses it in a group), and an answered one asks the detail again.
 */
function ReportAction({ target, serviceId, onAnswered }: { target: ServiceAskTarget; serviceId: string; onAnswered: () => void }) {
  return <SpaceActionButton jwt={target.jwt} spaceId={target.spaceId} values={serviceValuesOf(serviceId)} onAnswered={onAnswered} actionKey={SERVICE_REPORT_ACTION} label="Generar informe de servicio" testID="generar-informe-servicio" Icon={FileText} />;
}

/** The report's PDF made on demand from its sheet; nothing for a sheet that has its PDF already. */
function pdfActionOf(sheet: ReturnType<typeof detailSheet>, reportPdf: ReturnType<typeof useReportPdf>) {
  const asked = sheet?.pdfOnDemand;
  if (!sheet || !asked) return undefined;
  return { asking: reportPdf.asking, message: reportPdf.message, onAsk: () => void reportPdf.ask(asked, `${sheet.title} · PDF`) };
}

function DetailTabs({ detail, target, service, chatId, seesDrive, onBack, onOpenFile, links, seesMoney, admin, onReported, onCreateReport, onContinueReport, startTab, startOrderId, onTabChange }: { onContinueReport: (draft: { type: string; reportId: string }) => void; startOrderId?: string; onCreateReport: () => void; startTab: DetailTabKey; /** The map hides the service's head (o-01). */ onTabChange?: (tab: ServiceTabKey) => void; detail: ServiceDetail; target: ServiceAskTarget; service: SpaceClientService; chatId: string; seesDrive: boolean; onBack: () => void; onOpenFile: (file: ViewableFile, siblings?: readonly ViewableFile[]) => void; links?: ChannelLinks; seesMoney: boolean; admin: boolean; onReported: () => void }) {
  const [tab, setTab] = useState<ServiceTabKey>(startTab);
  useEffect(() => onTabChange?.(tab), [tab, onTabChange]);
  // The map and the Drive draw their own; what follows only reads Portal's lists.
  const listTab: DetailTabKey = tab === 'drive' || tab === 'map' ? 'orders' : tab;
  const serviceId = service.id;
  // An order's sheet opens its dispatches on top (José 01/11); closing goes back one.
  const [opened, setOpened] = useState<OpenSheet[]>(() => openingSheets(detail, startOrderId));
  const reportPdf = useReportPdf(target, serviceId, onOpenFile);
  const top = opened.at(-1);
  const sheet = top ? detailSheet(detail, top.tab, top.id) : null;
  const openRow = (id: string) => {
    const draft = listTab === 'reports' ? draftToContinue(detail, id) : null;
    if (draft) onContinueReport(draft);
    else setOpened([{ tab: listTab, id }]);
  };
  const openDispatch = (id: string) => setOpened((before) => [...before, { tab: 'dispatches', id }]);
  const close = () => {
    reportPdf.stop();
    setOpened((before) => before.slice(0, -1));
  };
  const rows = detailRows(detail, listTab);
  const more = moreInPortal(rows.length, detail.totals[listTab]);
  const strip = <TabStrip detail={detail} seesDrive={seesDrive} seesMap={Boolean(links?.can('service'))} tab={tab} onTab={setTab} />;
  if (tab === 'drive') return <>{strip}<ServiceDrive target={target} service={service} chatId={chatId} onBack={onBack} /></>;
  if (tab === 'map' && links) return <>{strip}<ServiceMapPanel jwt={target.jwt} links={links} target={{ kind: 'service', clientId: target.clientId, serviceId }} title={service.name} badge={<Text className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{CLIENT_SERVICE_STATUS_LABELS[service.status]}</Text>} admin={admin} discharges={detail.discharges} send={workProgressSender(admin, target, chatId, serviceId)} /></>;
  return (
    <>
      {strip}
      {tab === 'reports' ? <CreateReportButton onPress={onCreateReport} /> : null}
      {tab === 'reports' && seesMoney ? <ReportAction target={target} serviceId={serviceId} onAnswered={onReported} /> : null}
      <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
        {!rows.length ? <Text className="p-4 text-[14px] text-on-surface-variant">{detailEmptyText(listTab, detail.totals)}</Text> : tab === 'reports' ? <ReportDays detail={detail} onOpen={openRow} onOpenFile={onOpenFile} /> : rows.map((row) => <RowView key={row.id} row={row} onOpen={openRow} onOpenFile={onOpenFile} />)}
      </View>
      {tab === 'orders' ? <OrphanDispatches detail={detail} onOpen={openDispatch} onOpenFile={onOpenFile} /> : null}
      {more ? <Text className="text-center text-[12px] text-on-surface-variant">{`${more} · el resto está en el Portal`}</Text> : null}
      <RecordSheet sheet={sheet} onClose={close} onOpenFile={onOpenFile} pdf={pdfActionOf(sheet, reportPdf)} onOpenRelated={openDispatch} action={orderLinkAction(links, top, target)} />
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

type ServiceDetailProps = { /** Who can be a report's responsible. */ people?: readonly string[]; target: ServiceAskTarget; chatId: string; service: SpaceClientService; seesMoney: boolean; /** A space admin: the map's suggested progress (design o-07). */ admin?: boolean; onBack: () => void; links?: ChannelLinks; /** Opens on that order's sheet: an order's card in the chat sent here. */ startOrderId?: string ; /** Its Drive joins the tabs (José 06/11). */ seesDrive?: boolean; /** A member an admin gave only the Drive. */ driveOnly?: boolean; onToChat?: () => void };

/** José 06/11: an open service takes the whole chat, and this is the way back to it. It stays while the service scrolls. */
function ServiceCrumbs(props: { service: string; onBack: () => void; onToChat?: () => void }) {
  const colors = useColores();
  return (
    <View testID="ruta-servicio" className="min-h-[48px] flex-row items-center gap-1.5 border-b border-outline/10 bg-surface px-3">
      {props.onToChat ? (
        <Pressable testID="volver-al-chat" onPress={props.onToChat} className="min-h-[44px] flex-row items-center gap-1">
          <ChevronLeft size={18} color={colors.primary} />
          <Text className="text-[14px] font-semibold text-primary">Chat</Text>
        </Pressable>
      ) : null}
      {props.onToChat ? <ChevronRight size={14} color={colors['on-surface-variant']} /> : null}
      <Pressable testID="volver-a-servicios" onPress={props.onBack} className="min-h-[44px] justify-center"><Text className="text-[14px] font-semibold text-primary">Servicios</Text></Pressable>
      <ChevronRight size={14} color={colors['on-surface-variant']} />
      <Text className="min-w-0 flex-1 text-[14px] text-on-surface-variant" numberOfLines={1}>{props.service}</Text>
    </View>
  );
}

/**
 * A client's service as an expediente (José 30/10: there was no way to see a
 * service's reports, orders and dispatches; design f-04): its head, then
 * Pedidos · Informes · Drive, each order with its dispatches inside (José
 * 01/11). Asked when it opens.
 */
export function ServiceDetailView(props: ServiceDetailProps) {
  if (!props.driveOnly) return <ServiceRecordsDetail {...props} />;
  return (
    <View className="flex-1">
      <ServiceCrumbs service={props.service.name} onBack={props.onBack} onToChat={props.onToChat} />
      <ScrollView testID="detalle-servicio" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ServiceHead service={props.service} detail={null} />
        <ServiceDrive target={props.target} service={props.service} chatId={props.chatId} onBack={props.onBack} />
      </ScrollView>
    </View>
  );
}

function ServiceRecordsDetail(props: ServiceDetailProps) {
  // After a report the detail is asked again, keeping the open tab (agentes 31/10).
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
  // José 05/11: a field report is filled here, not in Portal's public page (spec INFORMES-DESDE-LILACHAT); it takes the detail's place.
  const [picker, setPicker] = useState(false);
  const [report, setReport] = useState<{ type: string; reportId?: string; responsible?: string } | null>(null);
  // Back from the report, the detail opens on Informes, where it was.
  const [startTab, setStartTab] = useState<DetailTabKey>('orders');
  const [onMap, setOnMap] = useState(false);
  const onTabChange = useCallback((tab: ServiceTabKey) => setOnMap(tab === 'map'), []);
  const portalUrl = answer?.ok ? answer.value.service.url : undefined;
  const closeReport = useCallback((changed: boolean) => {
    setReport(null);
    setStartTab('reports');
    if (changed) askAgain();
  }, [askAgain]);
  if (report) return <ReportDocumentScreen target={props.target} chatId={props.chatId} service={props.service} type={report.type} {...(report.reportId ? { reportId: report.reportId } : {})} {...(report.responsible ? { responsible: report.responsible } : {})} portalUrl={portalUrl} onClose={closeReport} />;
  return (
    <View className="flex-1">
    <ServiceCrumbs service={props.service.name} onBack={props.onBack} onToChat={props.onToChat} />
    <ScrollView testID="detalle-servicio" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      {onMap ? null : <ServiceHead service={props.service} detail={answer?.ok ? answer.value : null} admin={Boolean(props.admin)} />}
      {answer === null ? <Skeleton /> : null}
      {answer?.ok ? <DetailTabs onContinueReport={setReport} detail={answer.value} target={props.target} service={props.service} chatId={props.chatId} seesDrive={Boolean(props.seesDrive)} onBack={onBack} onOpenFile={files.open} links={props.links} seesMoney={props.seesMoney} admin={Boolean(props.admin)} onReported={askAgain} onCreateReport={() => setPicker(true)} startTab={startTab} startOrderId={startTab === 'orders' ? props.startOrderId : undefined} onTabChange={onTabChange} /> : null}
      <CreateReportSheet visible={picker} portalUrl={portalUrl} people={props.people ?? []} onPick={(code, responsible) => { setPicker(false); setReport({ type: code, responsible }); }} onClose={() => setPicker(false)} />
      {files.notice ? <Text className="text-center text-[13px] text-error">{files.notice}</Text> : null}
      {files.viewer}
      {answer && !answer.ok ? (
        <View testID="detalle-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
          <Text className="text-[15px] font-semibold text-on-surface">{answer.message}</Text>
          {answer.portalUrl ? <PortalLink url={answer.portalUrl} label="Abrir el servicio en el Portal" testID="detalle-fallo-portal" /> : null}
          {answer.offline ? (
            <Pressable testID="crear-informe-sin-senal" onPress={() => setPicker(true)} className="mt-3 min-h-[48px] items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
              <Text className="text-[15px] font-semibold text-primary">Crear informe</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
    </View>
  );
}

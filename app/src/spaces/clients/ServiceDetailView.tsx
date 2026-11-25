import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ExternalLink, FilePlus, FileText } from 'lucide-react-native';
import { AREA_TYPE, draftToContinue, isObservationType, CLIENT_SERVICE_STATUS_LABELS, SERVICE_REPORT_ACTION, serviceValuesOf, detailRows, detailSheet, serviceTabs, openingSheets, moreInPortal, portalMapTabUrl, type ChannelLinks, type DetailTabKey, type ServiceAskResult, type ServiceTabItem, type ServiceTabKey, type ServiceDetail, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import type { ViewableFile } from '@lilachat/shared';
import { RecordSheet } from './RecordSheet';
import { ServiceDrive } from './ServiceDrive';
import { ServiceList } from './ServiceLists';
import { ServiceMapPanel } from './ServiceMapPanel';
import { ServiceShell } from './ServiceShell';
import { mapPhotoUploader, mapTraceUploader } from './useDriveUpload';
import { doorMapLinks, mapEditSender, serviceLinkSender, workProgressSender, workStreetDeleteSender, workStreetSender } from './workMap/workProgressSender';
import { ServiceLinkSheet } from './ServiceLinkSheet';
import { ServiceStages } from './ServiceStages';
import { SpaceActionButton } from './SpaceActionButton';
import { STATUS_TONE } from './tones';
import { useFileViewer } from './useFileViewer';
import { useReportPdf } from './useReportPdf';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';
import { CreateReportSheet } from './reports/CreateReportSheet';
import { ReportDocumentScreen } from './reports/ReportDocumentScreen';
import { ObservationsScreen } from './observations/ObservationsScreen';
import { AreasScreen } from './areas/AreasScreen';

type OpenFile = (file: ViewableFile, siblings?: readonly ViewableFile[]) => void;
const BODY = { padding: 16, gap: 12, paddingBottom: 40 };

/** «Crear informe» at the right of the tab bar (design cc-03), for everyone with the services (José 05/11). */
function CreateReportButton({ onPress }: { onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID="crear-informe" onPress={onPress} className="min-h-[44px] flex-row items-center gap-1.5 rounded-xl bg-primary px-3">
      <FilePlus size={17} color={colors['on-primary']} />
      <Text className="text-[14px] font-bold text-on-primary">Crear informe</Text>
    </Pressable>
  );
}

/**
 * «Generar informe de servicio» above Informes (José 31/10): the liquidation carries amounts, so
 * only for whoever sees money (José 05/11). It runs from the space; an answered one asks again.
 */
function ReportAction({ target, serviceId, onAnswered }: { target: ServiceAskTarget; serviceId: string; onAnswered: () => void }) {
  return <SpaceActionButton jwt={target.jwt} spaceId={target.spaceId} values={serviceValuesOf(serviceId)} onAnswered={onAnswered} actionKey={SERVICE_REPORT_ACTION} label="Generar informe de servicio" testID="generar-informe-servicio" Icon={FileText} />;
}

/** An order's sheet makes its link with what Portal's modal asks (José 31/10); other sheets have no button. */
type OpenSheet = { tab: DetailTabKey; id: string };
const orderLinkAction = (links: ChannelLinks | undefined, top: OpenSheet | undefined, target: ServiceAskTarget) =>
  links?.can('order') && top?.tab === 'orders' ? { label: 'Crear enlace del pedido', onPress: () => links.open({ kind: 'order', clientId: target.clientId, orderId: top.id }) } : undefined;

/** The report's PDF made on demand from its sheet; nothing for a sheet that has its PDF already. */
function pdfActionOf(sheet: ReturnType<typeof detailSheet>, reportPdf: ReturnType<typeof useReportPdf>) {
  const asked = sheet?.pdfOnDemand;
  if (!sheet || !asked) return undefined;
  return { asking: reportPdf.asking, message: reportPdf.message, onAsk: () => void reportPdf.ask(asked, `${sheet.title} · PDF`, Boolean(sheet.pdfPreview)) };
}

type ListProps = { detail: ServiceDetail; target: ServiceAskTarget; serviceId: string; tab: DetailTabKey; links?: ChannelLinks; seesMoney: boolean; admin: boolean; startOrderId?: string; startReportId?: string; onOpenFile: OpenFile; onReported: () => void; onContinueReport: (draft: { type: string; reportId: string }) => void };

/** Pedidos or Informes: the list, its sheets on top and what Portal has beyond the 100 it sent. */
function ServiceLists(props: ListProps) {
  const { detail, tab } = props;
  // An order's sheet opens its dispatches on top (José 01/11); closing goes back one.
  const [opened, setOpened] = useState<OpenSheet[]>(() => openingSheets(detail, props.startOrderId));
  const reportPdf = useReportPdf(props.target, props.serviceId, props.onOpenFile);
  const top = opened.at(-1);
  const sheet = top ? detailSheet(detail, top.tab, top.id) : null;
  const openRow = (id: string) => {
    const draft = tab === 'reports' ? draftToContinue(detail, id) : null;
    if (draft) props.onContinueReport(draft);
    else setOpened([{ tab, id }]);
  };
  // An «INFORME» card (José 25/11) opens its report once, as a tap on its row would.
  const startedReport = useRef(false);
  useEffect(() => {
    if (startedReport.current || !props.startReportId || tab !== 'reports') return;
    startedReport.current = true;
    if (detail.reports.some((one) => one.id === props.startReportId)) openRow(props.startReportId);
  });
  const openDispatch = (id: string) => setOpened((before) => [...before, { tab: 'dispatches', id }]);
  const close = () => {
    reportPdf.stop();
    setOpened((before) => before.slice(0, -1));
  };
  const more = moreInPortal(detailRows(detail, tab).length, detail.totals[tab]);
  return (
    <>
      {props.admin ? <ServiceStages detail={detail} /> : null}
      {tab === 'reports' && props.seesMoney ? <ReportAction target={props.target} serviceId={props.serviceId} onAnswered={props.onReported} /> : null}
      <ServiceList detail={detail} tab={tab} onOpen={openRow} onOpenDispatch={(id) => setOpened([{ tab: 'dispatches', id }])} onOpenFile={props.onOpenFile} />
      {more ? <Text className="text-center text-[12px] text-on-surface-variant">{`${more} · el resto está en el Portal`}</Text> : null}
      <RecordSheet sheet={sheet} onClose={close} onOpenFile={props.onOpenFile} pdf={pdfActionOf(sheet, reportPdf)} onOpenRelated={openDispatch} action={orderLinkAction(props.links, top, props.target)} />
    </>
  );
}

type ServiceDetailProps = { /** Who can be a report's responsible. */ people?: readonly string[]; target: ServiceAskTarget; chatId: string; service: SpaceClientService; seesMoney: boolean; /** The client's name, the head's kicker (design cc-02). */ clientName?: string; /** A phone: the back arrow and the compact head (design cc-02 mobile). */ compact?: boolean; /** A space admin: the stages, which read money (José 07/11). */ admin?: boolean; onBack: () => void; links?: ChannelLinks; /** Opens on that order's sheet: an order's card in the chat sent here. */ startOrderId?: string; /** Opens on Informes with that report: an «INFORME» card sent here (José 25/11). */ startReportId?: string; /** Its Drive joins the tabs (José 06/11). */ seesDrive?: boolean; /** A member an admin gave only the Drive. */ driveOnly?: boolean };

/**
 * «Enlace del servicio» in the head (José 31/10): only where the channel's app offers it. José 20/11:
 * it opens its sheet over the service and makes the link there, instead of jumping to the chat.
 */
function useServiceLinkSheet(props: ServiceDetailProps) {
  const [open, setOpen] = useState(false);
  const onShare = props.links?.can('service') ? () => setOpen(true) : undefined;
  const sheet = onShare ? <ServiceLinkSheet visible={open} serviceName={props.service.name} create={serviceLinkSender(props.target, props.chatId, props.service.id)} onClose={() => setOpen(false)} /> : null;
  return { onShare, sheet };
}

/** Android's BACK goes back to the list; the last listener added runs first. */
function useBackToList(onBack: () => void) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);
}

/**
 * A client's service (José 30/10, design f-04; José 19/11, designs cc-02…cc-05): the head and
 * Pedidos · Informes · Mapa · Drive under ONE bar, each order with its dispatches inside. Asked
 * when it opens.
 */
export function ServiceDetailView(props: ServiceDetailProps) {
  if (!props.driveOnly) return <ServiceRecordsDetail {...props} />;
  return <ServiceDriveOnly {...props} />;
}

/** A member an admin gave only the Drive: its one tab under the same head. */
function ServiceDriveOnly(props: ServiceDetailProps) {
  const share = useServiceLinkSheet(props);
  const tabs: ServiceTabItem[] = [{ key: 'drive', label: 'Drive' }];
  return (
    <ServiceShell service={props.service} clientName={props.clientName} compact={props.compact ?? true} tabs={tabs} tab="drive" onTab={() => undefined} onBack={props.onBack} onShare={share.onShare}>
      <ScrollView testID="detalle-cuerpo" keyboardShouldPersistTaps="handled" contentContainerStyle={BODY}>
        <ServiceDrive target={props.target} service={props.service} chatId={props.chatId} onBack={props.onBack} />
      </ScrollView>
      {share.sheet}
    </ServiceShell>
  );
}

type BodyProps = ServiceDetailProps & { answer: ServiceAskResult<ServiceDetail> | null; tab: ServiceTabKey; startTab: DetailTabKey; onOpenFile: OpenFile; onReported: () => void; onCreate: () => void; onContinueReport: (draft: { type: string; reportId: string }) => void };

function PortalLink(props: { url: string; label: string; testID: string }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} onPress={() => void Linking.openURL(props.url)} className="min-h-[44px] flex-row items-center gap-1.5">
      <ExternalLink size={15} color={colors.primary} />
      <Text className="text-[14px] font-semibold text-primary">{props.label}</Text>
    </Pressable>
  );
}

/** The detail failed: why, Portal's link and, without signal, a report can still be made. */
function DetailFailure({ answer, onCreate }: { answer: Extract<ServiceAskResult<ServiceDetail>, { ok: false }>; onCreate: () => void }) {
  return (
    <View testID="detalle-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
      <Text className="text-[15px] font-semibold text-on-surface">{answer.message}</Text>
      {answer.portalUrl ? <PortalLink url={answer.portalUrl} label="Abrir el servicio en el Portal" testID="detalle-fallo-portal" /> : null}
      {answer.offline ? (
        <Pressable testID="crear-informe-sin-senal" onPress={onCreate} className="mt-3 min-h-[48px] items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
          <Text className="text-[15px] font-semibold text-primary">Crear informe</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The open section under the bar: the map, the Drive, or Pedidos / Informes. */
function ServiceBody(props: BodyProps) {
  const { answer, tab, target, service } = props;
  if (answer === null) return <View testID="detalle-cargando" className="h-40 rounded-2xl bg-surface-variant" />;
  if (!answer.ok) return <DetailFailure answer={answer} onCreate={props.onCreate} />;
  const detail = answer.value;
  const serviceId = service.id;
  if (tab === 'drive') return <ServiceDrive target={target} service={service} chatId={props.chatId} onBack={props.onBack} marks={detail.photoMarks} />;
  if (tab === 'map' && props.links) return <ServiceMapPanel jwt={target.jwt} links={doorMapLinks(props.links, target, props.chatId, serviceId)} target={{ kind: 'service', clientId: target.clientId, serviceId }} title={service.name} badge={<Text className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{CLIENT_SERVICE_STATUS_LABELS[service.status]}</Text>} drawUrl={portalMapTabUrl(detail.service.url)} discharges={detail.discharges} mapPhotos={detail.mapPhotos} start={detail.service.location} send={workProgressSender(target, props.chatId, serviceId)} drawStreet={workStreetSender(target, props.chatId, serviceId)} deleteStreet={workStreetDeleteSender(target, props.chatId, serviceId)} editMap={mapEditSender(target, props.chatId, serviceId)} admin={props.seesMoney} uploadPhoto={mapPhotoUploader(target, props.chatId, serviceId)} uploadTrace={mapTraceUploader(target, props.chatId, serviceId)} mapInReport={detail.service.mapInReport} />;
  if (tab !== 'orders' && tab !== 'reports') return null;
  return <ServiceLists detail={detail} target={target} serviceId={serviceId} tab={tab} links={props.links} seesMoney={props.seesMoney} admin={Boolean(props.admin)} startOrderId={tab === 'orders' && props.startTab === 'orders' ? props.startOrderId : undefined} startReportId={tab === 'reports' ? props.startReportId : undefined} onOpenFile={props.onOpenFile} onReported={props.onReported} onContinueReport={props.onContinueReport} />;
}

function ServiceRecordsDetail(props: ServiceDetailProps) {
  // After a report the detail is asked again, keeping the open tab (agentes 31/10).
  const [round, setRound] = useState(0);
  const askAgain = useCallback(() => setRound((count) => count + 1), []);
  const answer = useServiceAsk('detail', props.target, props.service.id, round);
  const files = useFileViewer();
  const share = useServiceLinkSheet(props);
  useBackToList(props.onBack);
  // José 05/11: a field report is filled here, not in Portal's public page; it takes the detail's place.
  const [picker, setPicker] = useState(false);
  const [report, setReport] = useState<{ type: string; reportId?: string; responsible?: string } | null>(null);
  // Back from the report, the detail opens on Informes, where it was.
  const [startTab, setStartTab] = useState<DetailTabKey>(props.startReportId ? 'reports' : 'orders');
  const [tab, setTab] = useState<ServiceTabKey>(props.startReportId ? 'reports' : 'orders');
  const [startReportId, setStartReportId] = useState(props.startReportId);
  const portalUrl = answer?.ok ? answer.value.service.url : undefined;
  const closeReport = useCallback((changed: boolean) => {
    setReport(null);
    setStartReportId(undefined);
    setStartTab('reports');
    setTab('reports');
    if (changed) askAgain();
  }, [askAgain]);
  // José 11/11: the registry and the lifting of observations have their own screens (designs ob-01…ob-03).
  if (report && isObservationType(report.type)) return <ObservationsScreen target={props.target} chatId={props.chatId} serviceId={props.service.id} service={props.service} type={report.type} {...(report.reportId ? { reportId: report.reportId } : {})} portalUrl={portalUrl} onClose={closeReport} />;
  if (report?.type === AREA_TYPE) return <AreasScreen to={{ target: props.target, chatId: props.chatId, serviceId: props.service.id }} service={props.service} links={props.links} {...(report.reportId ? { reportId: report.reportId } : {})} onClose={closeReport} />;
  if (report) return <ReportDocumentScreen target={props.target} chatId={props.chatId} service={props.service} type={report.type} {...(report.reportId ? { reportId: report.reportId } : {})} {...(report.responsible ? { responsible: report.responsible } : {})} portalUrl={portalUrl} links={props.links} admin={Boolean(props.admin)} onClose={closeReport} />;
  const tabs = answer?.ok ? serviceTabs(answer.value, Boolean(props.seesDrive), Boolean(props.links)) : [];
  // José 20/11 (design mapa-v2): the map takes the rest of the screen and moves, outside the scroll.
  const mapOpen = tab === 'map' && Boolean(props.links) && Boolean(answer?.ok);
  const body = <ServiceBody {...props} answer={answer} tab={tab} startTab={startTab} startReportId={startReportId} onOpenFile={files.open} onReported={askAgain} onCreate={() => setPicker(true)} onContinueReport={setReport} />;
  const extras = (
    <>
      <CreateReportSheet visible={picker} portalUrl={portalUrl} seesMoney={props.seesMoney} people={props.people ?? []} onPick={(code, responsible) => { setPicker(false); setReport({ type: code, responsible }); }} onClose={() => setPicker(false)} />
      {files.notice ? <Text className="text-center text-[13px] text-error">{files.notice}</Text> : null}
      {files.viewer}
    </>
  );
  return (
    <ServiceShell service={props.service} clientName={props.clientName} compact={props.compact ?? true} slim={mapOpen} tabs={tabs} tab={tab} onTab={setTab} onBack={props.onBack} onShare={share.onShare} portalUrl={portalUrl} actions={answer?.ok && tab === 'reports' ? <CreateReportButton onPress={() => setPicker(true)} /> : undefined}>
      {mapOpen ? <View testID="detalle-cuerpo" className="flex-1">{body}{extras}</View> : (
        <ScrollView testID="detalle-cuerpo" keyboardShouldPersistTaps="handled" contentContainerStyle={BODY}>{body}{extras}</ScrollView>
      )}
      {share.sheet}
    </ServiceShell>
  );
}

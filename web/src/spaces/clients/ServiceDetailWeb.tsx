import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, FilePlus, FileText } from 'lucide-react';
import { AREA_TYPE, createsInEmbed, draftToContinue, embedCreateRequest, opensEmbed, reportTypeLabel, isObservationType, SERVICE_REPORT_ACTION, serviceValuesOf, detailRows, detailSheet, serviceTabs, openingSheets, moreInPortal, type ChannelLinks, type DetailTabKey, type ServiceTabKey, type EmbedCreateRequest, type ServiceAskResult, type ServiceDetail, type ServiceReport, type ServiceTabItem, type SpaceClientService } from '@lilachat/shared';
import { usePortalFileViewer } from './PortalFileViewer';
import { RecordSheetWeb } from './RecordSheetWeb';
import { ServiceDriveWeb } from './ServiceDriveWeb';
import { ServiceListWeb } from './ServiceListsWeb';
import { SHELL_PRIMARY, ServiceShellWeb, useCompactShell } from './ServiceShellWeb';
import { MapWorkspace } from './workMap/MapWorkspace';
import { doorMapLinks, serviceLinkSender } from './workMap/workProgressSender';
import { ServiceLinkSheetWeb } from './ServiceLinkSheetWeb';
import { ServiceStagesWeb } from './ServiceStagesWeb';
import { SpaceActionButtonWeb } from './SpaceActionButtonWeb';
import { useReportPdf } from './useReportPdf';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';
import { CreateReportDialog } from './reports/CreateReportDialog';
import { ReportDocumentWeb } from './reports/ReportDocumentWeb';
import { PortalEmbedWeb } from './reports/PortalEmbedWeb';
import { ObservationsWeb } from './observations/ObservationsWeb';
import { AreasWeb } from './areas/AreasWeb';

/** An order's sheet makes its link with what Portal's modal asks (José 31/10); other sheets have no button. */
type OpenSheet = { tab: DetailTabKey; id: string };
const orderLinkAction = (links: ChannelLinks | undefined, top: OpenSheet | undefined, target: ServiceAskTarget) =>
  links?.can('order') && top?.tab === 'orders' ? { label: 'Crear enlace del pedido', onPress: () => links.open({ kind: 'order', clientId: target.clientId, orderId: top.id }) } : undefined;

/**
 * «Crear informe» at the right of Informes' own toolbar (design cc-03), for everyone with the
 * services (José 05/11). Not in the shared tab bar: crammed there with the other tabs it pushed
 * the service header to a second row on a computer (audit 20/11).
 */
const CreateReportButton = ({ onPress }: { onPress: () => void }) => (
  <button type="button" data-testid="crear-informe" onClick={onPress} className={SHELL_PRIMARY}><FilePlus size={16} /> Crear informe</button>
);

/**
 * «Generar informe de servicio» above Informes (José 31/10): the liquidation carries amounts, so
 * only for whoever sees money (José 05/11). It runs from the space; an answered one asks the detail again.
 */
function ReportAction({ target, serviceId, onAnswered }: { target: ServiceAskTarget; serviceId: string; onAnswered: () => void }) {
  return <SpaceActionButtonWeb jwt={target.jwt} spaceId={target.spaceId} values={serviceValuesOf(serviceId)} onAnswered={onAnswered} actionKey={SERVICE_REPORT_ACTION} label="Generar informe de servicio" testId="generar-informe-servicio" Icon={FileText} />;
}

type ListProps = { detail: ServiceDetail; target: ServiceAskTarget; serviceId: string; links?: ChannelLinks; seesMoney: boolean; admin: boolean; tab: DetailTabKey; startOrderId?: string; startReportId?: string; onReported: () => void; onCreateReport: () => void; onContinueReport: (draft: { type: string; reportId: string }) => void; onOpenEmbed: (report: ServiceReport) => void };

/** Pedidos or Informes: the list, its sheets on top and what Portal has beyond the 100 it sent. */
function ServiceLists(props: ListProps) {
  const { detail, tab } = props;
  const viewer = usePortalFileViewer();
  // An order's sheet opens its dispatches on top (José 01/11); closing goes back one.
  const [opened, setOpened] = useState<OpenSheet[]>(() => openingSheets(detail, props.startOrderId));
  const more = moreInPortal(detailRows(detail, tab).length, detail.totals[tab]);
  const top = opened.at(-1);
  const sheet = top ? detailSheet(detail, top.tab, top.id) : null;
  const reportPdf = useReportPdf(props.target, props.serviceId);
  const openRow = (id: string) => {
    // Portal 11/11, José 12/11: on a wide window a report its canvas edits opens there, draft or not.
    const row = tab === 'reports' ? detail.reports.find((one) => one.id === id) : undefined;
    const draft = row ? draftToContinue(detail, id) : null;
    if (row && (opensEmbed(window.innerWidth, row) || (draft && createsInEmbed(window.innerWidth, draft.type)))) props.onOpenEmbed(row);
    else if (draft) props.onContinueReport(draft);
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
  return (
    <>
      {tab === 'reports' ? <div className="flex justify-end"><CreateReportButton onPress={props.onCreateReport} /></div> : null}
      {props.admin ? <ServiceStagesWeb detail={detail} /> : null}
      {tab === 'reports' && props.seesMoney ? <ReportAction target={props.target} serviceId={props.serviceId} onAnswered={props.onReported} /> : null}
      <ServiceListWeb detail={detail} tab={tab} onOpen={openRow} onOpenDispatch={(id) => setOpened([{ tab: 'dispatches', id }])} onOpenFile={viewer.open} />
      {viewer.viewer}
      {sheet ? <RecordSheetWeb sheet={sheet} onClose={close} onOpenFile={viewer.open} pdf={sheet.pdfOnDemand ? { asking: reportPdf.asking, message: reportPdf.message, readyUrl: reportPdf.readyUrl, onAsk: () => void reportPdf.ask(sheet.pdfOnDemand!) } : undefined} onOpenRelated={openDispatch} action={orderLinkAction(props.links, top, props.target)} /> : null}
      {more ? <p className="text-center text-[12px] text-on-surface-variant">{`${more} · el resto está en el Portal`}</p> : null}
    </>
  );
}

type ServiceDetailProps = { /** Who can be a report's responsible. */ people?: readonly string[]; target: ServiceAskTarget; chatId: string; service: SpaceClientService; seesMoney: boolean; /** The client's name, the head's kicker (design cc-02). */ clientName?: string; /** The map takes the whole body: the channel drops its padding and scroll. */ onMapOpen?: (open: boolean) => void; /** A space admin: the stages, which read money (José 07/11). */ admin?: boolean; onBack: () => void; links?: ChannelLinks; /** Opens on that order's sheet: an order's card in the chat sent here. */ startOrderId?: string; /** Opens on Informes with that report open: an «INFORME» card sent here (José 25/11). */ startReportId?: string; /** Its Drive joins the tabs (José 06/11). */ seesDrive?: boolean; /** A member an admin gave only the Drive. */ driveOnly?: boolean };

/**
 * «Enlace del servicio» in the head (José 31/10): only where the channel's app offers it. José 20/11:
 * it opens its sheet over the service and makes the link there, instead of jumping to the chat.
 */
function useServiceLinkSheet(props: ServiceDetailProps) {
  const [open, setOpen] = useState(false);
  const onShare = props.links?.can('service') ? () => setOpen(true) : undefined;
  const sheet = open ? <ServiceLinkSheetWeb serviceName={props.service.name} create={serviceLinkSender(props.target, props.chatId, props.service.id)} onClose={() => setOpen(false)} /> : null;
  return { onShare, sheet };
}

/** Over the editor's «Editar croquis», the map's way back to the report (José 16/11). */
function BackToReport(props: { onBack: () => void }) {
  return (
    <button type="button" data-testid="mapa-volver-al-informe" onClick={props.onBack} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary">
      <ChevronLeft size={16} /> Volver al informe
    </button>
  );
}

/** A report, an observation or an area takes the service's place, with the channel's scroll. */
const Takeover = ({ children }: { children: ReactNode }) => <div className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6"><div className="mx-auto max-w-3xl">{children}</div></div>;

/**
 * A client's service (José 30/10, design f-04; José 19/11, designs cc-02…cc-05): the head and
 * Pedidos · Informes · Mapa · Drive under ONE bar, each order with its dispatches inside. Asked
 * when it opens.
 */
export function ServiceDetailWeb(props: ServiceDetailProps) {
  const compact = useCompactShell();
  if (!props.driveOnly) return <ServiceRecordsDetail {...props} compact={compact} />;
  return <ServiceDriveOnly {...props} compact={compact} />;
}

/** A member an admin gave only the Drive: its one tab under the same head. */
function ServiceDriveOnly(props: ServiceDetailProps & { compact: boolean }) {
  const share = useServiceLinkSheet(props);
  const tabs: ServiceTabItem[] = [{ key: 'drive', label: 'Drive' }];
  return (
    <ServiceShellWeb service={props.service} clientName={props.clientName} compact={props.compact} tabs={tabs} tab="drive" onTab={() => undefined} onBack={props.onBack} onShare={share.onShare}>
      <ServiceDriveWeb target={props.target} service={props.service} chatId={props.chatId} />
      {share.sheet}
    </ServiceShellWeb>
  );
}

type ReportOpen = { type: string; reportId?: string; responsible?: string };
type Framed = Pick<ServiceReport, 'title'> & Partial<Pick<ServiceReport, 'id' | 'url'>> & { create?: EmbedCreateRequest };

/** What is filled from here (José 05/11: not in Portal's public page): the report, Portal's editor framed, the picker. */
function useReportFlows(askAgain: () => void, onClosed: () => void) {
  const [picker, setPicker] = useState(false);
  const [report, setReport] = useState<ReportOpen | null>(null);
  const [framed, setFramed] = useState<Framed | null>(null);
  // José 12/11: on the wide web a new report is born in Portal's editor; the form is for the APK and the phone.
  const pickNew = (code: string, responsible: string) => (createsInEmbed(window.innerWidth, code) ? setFramed({ title: reportTypeLabel(code), create: embedCreateRequest(code, responsible) }) : setReport({ type: code, responsible }));
  const closeFramed = useCallback((changed: boolean) => {
    setFramed(null);
    if (changed) askAgain();
  }, [askAgain]);
  const closeReport = useCallback((changed: boolean) => {
    setReport(null);
    onClosed();
    if (changed) askAgain();
  }, [askAgain, onClosed]);
  return { picker, setPicker, report, setReport, framed, setFramed, pickNew, closeFramed, closeReport };
}

function ServiceRecordsDetail(props: ServiceDetailProps & { compact: boolean }) {
  // After a report the detail is asked again, keeping the open tab (agentes 31/10).
  const [round, setRound] = useState(0);
  const askAgain = useCallback(() => setRound((count) => count + 1), []);
  const answer = useServiceAsk('detail', props.target, props.service.id, round);
  const [tab, setTab] = useState<ServiceTabKey>(props.startReportId ? 'reports' : 'orders');
  // The order's card opens its sheet once; coming back from another tab does not open it again.
  const [startOrderId, setStartOrderId] = useState(props.startOrderId);
  const [startReportId, setStartReportId] = useState(props.startReportId);
  const pickTab = useCallback((next: ServiceTabKey) => {
    setStartOrderId(undefined);
    setStartReportId(undefined);
    setTab(next);
  }, []);
  // Back from the report, the detail opens on Informes, where it was.
  const flows = useReportFlows(askAgain, useCallback(() => { setStartOrderId(undefined); setStartReportId(undefined); setTab('reports'); }, []));
  const portalUrl = answer?.ok ? answer.value.service.url : undefined;
  const mapOpen = tab === 'map' && Boolean(props.links) && Boolean(answer?.ok);
  const { onMapOpen } = props;
  useEffect(() => {
    onMapOpen?.(mapOpen);
    return () => onMapOpen?.(false);
  }, [mapOpen, onMapOpen]);
  const channelLinks = props.links;
  const share = useServiceLinkSheet(props);
  // «Editar croquis» in Portal's editor draws this same map over it; closing it redraws the croquis.
  const croquisMap = answer?.ok && channelLinks ? (done: () => void) => <MapWorkspace admin={props.seesMoney} crumbs={<BackToReport onBack={done} />} detail={answer.value} service={props.service} links={doorMapLinks(channelLinks, props.target, props.chatId, props.service.id)} target={props.target} chatId={props.chatId} /> : undefined;
  if (flows.report) return <ReportTakeover {...props} report={flows.report} portalUrl={portalUrl} onClose={flows.closeReport} />;
  const tabs = answer?.ok ? serviceTabs(answer.value, Boolean(props.seesDrive), Boolean(props.links)) : [];
  return (
    <ServiceShellWeb service={props.service} clientName={props.clientName} compact={props.compact} tabs={tabs} tab={tab} onTab={pickTab} onBack={props.onBack} onShare={share.onShare} portalUrl={portalUrl} flush={mapOpen}>
      <ServiceBody {...props} answer={answer} tab={tab} mapOpen={mapOpen} startOrderId={startOrderId} startReportId={startReportId} askAgain={askAgain} flows={flows} />
      {flows.picker ? <CreateReportDialog portalUrl={portalUrl} people={props.people ?? []} seesMoney={props.seesMoney} inEditor={(code) => createsInEmbed(window.innerWidth, code)} onPick={(code, responsible) => { flows.setPicker(false); flows.pickNew(code, responsible); }} onClose={() => flows.setPicker(false)} /> : null}
      {share.sheet}
      {flows.framed ? <PortalEmbedWeb target={props.target} serviceId={props.service.id} serviceName={props.service.name} report={flows.framed} onClose={flows.closeFramed} {...(croquisMap ? { workMap: croquisMap } : {})} /> : null}
    </ServiceShellWeb>
  );
}

/** José 11/11: the registry and the lifting of observations have their own view (design ob-07b); José 12/11: the area too. */
function ReportTakeover(props: ServiceDetailProps & { report: ReportOpen; portalUrl?: string; onClose: (changed: boolean) => void }) {
  const { report } = props;
  const reportId = report.reportId ? { reportId: report.reportId } : {};
  if (report.type === AREA_TYPE) return <Takeover><AreasWeb target={props.target} chatId={props.chatId} service={props.service} {...reportId} portalUrl={props.portalUrl} onClose={props.onClose} /></Takeover>;
  if (isObservationType(report.type)) return <Takeover><ObservationsWeb target={props.target} chatId={props.chatId} service={props.service} type={report.type} {...reportId} portalUrl={props.portalUrl} onClose={props.onClose} /></Takeover>;
  return <Takeover><ReportDocumentWeb target={props.target} chatId={props.chatId} service={props.service} type={report.type} {...reportId} {...(report.responsible ? { responsible: report.responsible } : {})} portalUrl={props.portalUrl} links={props.links} admin={Boolean(props.admin)} onClose={props.onClose} /></Takeover>;
}

type BodyProps = ServiceDetailProps & { answer: ServiceAskResult<ServiceDetail> | null; tab: ServiceTabKey; mapOpen: boolean; startOrderId?: string; startReportId?: string; askAgain: () => void; flows: ReturnType<typeof useReportFlows> };

/** The open section under the bar: the map edge to edge, the Drive, or Pedidos / Informes. */
function ServiceBody(props: BodyProps) {
  const { answer, tab, flows } = props;
  if (answer === null) return <div data-testid="detalle-cargando" className="h-48 animate-pulse rounded-xl bg-surface" />;
  if (!answer.ok) return <DetailFailure answer={answer} onCreate={() => flows.setPicker(true)} />;
  if (props.mapOpen && props.links) return <MapWorkspace admin={props.seesMoney} detail={answer.value} service={props.service} links={doorMapLinks(props.links, props.target, props.chatId, props.service.id)} target={props.target} chatId={props.chatId} />;
  if (tab === 'drive') return <ServiceDriveWeb target={props.target} service={props.service} chatId={props.chatId} marks={answer.value.photoMarks} />;
  if (tab !== 'orders' && tab !== 'reports') return null;
  return <ServiceLists detail={answer.value} target={props.target} serviceId={props.service.id} links={props.links} seesMoney={props.seesMoney} admin={Boolean(props.admin)} tab={tab} startOrderId={tab === 'orders' ? props.startOrderId : undefined} startReportId={tab === 'reports' ? props.startReportId : undefined} onReported={props.askAgain} onCreateReport={() => flows.setPicker(true)} onContinueReport={flows.setReport} onOpenEmbed={flows.setFramed} />;
}

type Failed = Extract<ServiceAskResult<ServiceDetail>, { ok: false }>;

function DetailFailure({ answer, onCreate }: { answer: Failed; onCreate: () => void }) {
  return (
    <div data-testid="detalle-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-sm">
      <p className="mb-2 font-semibold">{answer.message}</p>
      {answer.portalUrl ? <a href={answer.portalUrl} target="_blank" rel="noreferrer" data-testid="detalle-fallo-portal" className="text-[13px] font-semibold text-primary hover:underline">Abrir el servicio en el Portal</a> : null}
      {answer.offline ? <button type="button" data-testid="crear-informe-sin-senal" onClick={onCreate} className="mt-2 h-11 w-full rounded-xl border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">Crear informe</button> : null}
    </div>
  );
}

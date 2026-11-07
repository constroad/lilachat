import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, FilePlus, FileText } from 'lucide-react';
import { draftToContinue, CLIENT_SERVICE_STATUS_LABELS, detailEmptyText, SERVICE_REPORT_ACTION, serviceStageLine, serviceValuesOf, detailRows, detailSheet, serviceTabs, openingSheets, moreInPortal, orphanDispatchesOf, reportGroups, type DetailRow, type ChannelLinks, type DetailTabKey, type ServiceTabKey, type ServiceDetail, type SpaceClientService } from '@lilachat/shared';
import { usePortalFileViewer } from './PortalFileViewer';
import type { OpenSheetFile } from './RecordSheetWeb';
import { RecordSheetWeb } from './RecordSheetWeb';
import { ServiceDriveWeb } from './ServiceDriveWeb';
import { ServiceMapWeb } from './ServiceMapWeb';
import { ServiceStagesWeb } from './ServiceStagesWeb';
import { SpaceActionButtonWeb } from './SpaceActionButtonWeb';
import { DETAIL_TONE, STATUS_TONE } from './tones';
import { useReportPdf } from './useReportPdf';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';
import { CreateReportDialog } from './reports/CreateReportDialog';
import { ReportDocumentWeb } from './reports/ReportDocumentWeb';

const PortalLink = (props: { url: string; label: string; testId: string }) => (
  <a href={props.url} target="_blank" rel="noreferrer" data-testid={props.testId} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline">
    <ExternalLink size={14} /> {props.label}
  </a>
);

/** The expediente's head (design f-04): kicker, name, state and stage with its progress. */
function ServiceHead({ service, detail }: { service: SpaceClientService; detail: ServiceDetail | null }) {
  return (
    <section className="rounded-xl border border-outline/15 border-t-[3px] border-t-primary bg-surface p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Servicio</p>
          <h2 className="mt-1 text-lg font-bold md:text-xl">{service.name}</h2>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{CLIENT_SERVICE_STATUS_LABELS[service.status]}</span>
      </div>
      {service.stage_label || service.progress !== undefined ? (
        <div className="mt-3 border-t border-outline/10 pt-3">
          <p className="flex justify-between text-sm">
            <span>{serviceStageLine(service)}</span>
            {service.progress !== undefined ? <span className="font-bold tabular-nums">{`${service.progress} %`}</span> : null}
          </p>
          {service.progress !== undefined ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${service.progress}%` }} /></div> : null}
        </div>
      ) : null}
      {detail ? <ServiceStagesWeb detail={detail} /> : null}
    </section>
  );
}

/** José 30/10: the row opens its sheet inside Lilachat; the file opens in Lilachat's viewer, not in Portal. */
function RowView({ row, onOpen, onOpenFile }: { row: DetailRow; onOpen: (id: string) => void; onOpenFile: OpenSheetFile }) {
  return (
    <li data-testid={`fila-${row.id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
      <button type="button" onClick={() => onOpen(row.id)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold hover:underline">{row.title}</p>
        {row.line ? <p className="truncate text-[12px] text-on-surface-variant">{row.line}</p> : null}
      </button>
      {row.file ? (
        <button type="button" onClick={() => row.file && onOpenFile({ url: row.file.url, name: `${row.title} · ${row.file.label}` })} data-testid={`archivo-${row.id}`} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-primary hover:underline"><FileText size={14} /> {row.file.label}</button>
      ) : null}
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[row.status.tone]}`}>{row.status.label}</span>
    </li>
  );
}

/** The reports under a header per day, like Portal's list (José 31/10). */
function ReportDays({ detail, onOpen, onOpenFile }: { detail: ServiceDetail; onOpen: (id: string) => void; onOpenFile: OpenSheetFile }) {
  return (
    <>
      {reportGroups(detail).map((group) => (
        <li key={group.title} data-testid={`dia-informes-${group.title}`}>
          <p className="bg-surface-variant/40 px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{group.title}</p>
          <ul className="divide-y divide-outline/10">{group.rows.map((row) => <RowView key={row.id} row={row} onOpen={onOpen} onOpenFile={onOpenFile} />)}</ul>
        </li>
      ))}
    </>
  );
}

/** An order's sheet makes its link with what Portal's modal asks (José 31/10); other sheets have no button. */
type OpenSheet = { tab: DetailTabKey; id: string };
const orderLinkAction = (links: ChannelLinks | undefined, top: OpenSheet | undefined, target: ServiceAskTarget) =>
  links?.can('order') && top?.tab === 'orders' ? { label: 'Crear enlace del pedido', onPress: () => links.open({ kind: 'order', clientId: target.clientId, orderId: top.id }) } : undefined;

/** «Crear informe» above Informes, for everyone with the services (José 05/11): the type picker, design j-01. */
function CreateReportButton({ onPress }: { onPress: () => void }) {
  return (
    <button type="button" data-testid="crear-informe" onClick={onPress} className="flex h-11 w-full items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-left text-sm font-semibold text-primary hover:bg-primary/15">
      <FilePlus size={16} />
      Crear informe
    </button>
  );
}

/**
 * «Generar informe de servicio» above Informes (José 31/10): the liquidation
 * carries amounts, so only for whoever sees money (José 05/11). It runs from
 * the space (Portal refuses it in a group), and an answered one asks the detail again.
 */
function ReportAction({ target, serviceId, onAnswered }: { target: ServiceAskTarget; serviceId: string; onAnswered: () => void }) {
  return <SpaceActionButtonWeb jwt={target.jwt} spaceId={target.spaceId} values={serviceValuesOf(serviceId)} onAnswered={onAnswered} actionKey={SERVICE_REPORT_ACTION} label="Generar informe de servicio" testId="generar-informe-servicio" Icon={FileText} />;
}

/** Dispatches whose order did not come in the 100 Portal sent (José 01/11: they live inside their order). */
function OrphanDispatches({ detail, onOpen, onOpenFile }: { detail: ServiceDetail; onOpen: (id: string) => void; onOpenFile: OpenSheetFile }) {
  const rows = orphanDispatchesOf(detail);
  if (!rows.length) return null;
  return (
    <section data-testid="despachos-sin-pedido" className="overflow-hidden rounded-xl border border-outline/15 bg-surface">
      <p className="bg-surface-variant/40 px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Despachos de otros pedidos</p>
      <ul className="divide-y divide-outline/10">{rows.map((row) => <RowView key={row.id} row={row} onOpen={onOpen} onOpenFile={onOpenFile} />)}</ul>
    </section>
  );
}

/** The open tab's body: the reports go by day; the rest, a row each. */
function TabBody({ detail, tab, onOpen, onOpenFile }: { detail: ServiceDetail; tab: DetailTabKey; onOpen: (id: string) => void; onOpenFile: OpenSheetFile }) {
  const rows = detailRows(detail, tab);
  return (
    <ul className="divide-y divide-outline/10 overflow-hidden rounded-xl border border-outline/15 bg-surface">
      {!rows.length ? <li className="p-4 text-sm text-on-surface-variant">{detailEmptyText(tab, detail.totals)}</li> : tab === 'reports' ? <ReportDays detail={detail} onOpen={onOpen} onOpenFile={onOpenFile} /> : rows.map((row) => <RowView key={row.id} row={row} onOpen={onOpen} onOpenFile={onOpenFile} />)}
    </ul>
  );
}

function DetailTabs({ detail, target, service, chatId, seesDrive, links, seesMoney, onReported, onCreateReport, onContinueReport, startTab, startOrderId }: { onContinueReport: (draft: { type: string; reportId: string }) => void; startOrderId?: string; detail: ServiceDetail; target: ServiceAskTarget; service: SpaceClientService; chatId: string; seesDrive: boolean; links?: ChannelLinks; seesMoney: boolean; onReported: () => void; onCreateReport: () => void; startTab: DetailTabKey }) {
  const [tab, setTab] = useState<ServiceTabKey>(startTab);
  // The map and the Drive draw their own; what follows only reads Portal's lists.
  const listTab: DetailTabKey = tab === 'drive' || tab === 'map' ? 'orders' : tab;
  const serviceId = service.id;
  const viewer = usePortalFileViewer();
  // An order's sheet opens its dispatches on top (José 01/11); closing goes back one.
  const [opened, setOpened] = useState<OpenSheet[]>(() => openingSheets(detail, startOrderId));
  const shown = detailRows(detail, listTab).length;
  const more = moreInPortal(shown, detail.totals[listTab]);
  const top = opened.at(-1);
  const sheet = top ? detailSheet(detail, top.tab, top.id) : null;
  const reportPdf = useReportPdf(target, serviceId);
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
  const strip = (
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-outline/15 bg-surface p-1">
        {serviceTabs(detail, seesDrive, Boolean(links?.can('service'))).map((one) => (
          <button key={one.key} type="button" role="tab" aria-selected={tab === one.key} data-testid={`pestana-detalle-${one.key}`} onClick={(event) => { setTab(one.key); event.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }} className={`h-9 shrink-0 rounded-lg px-3 text-sm ${tab === one.key ? 'bg-primary font-semibold text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{one.label}</button>
        ))}
      </div>
  );
  if (tab === 'drive') return <>{strip}<ServiceDriveWeb target={target} service={service} chatId={chatId} /></>;
  if (tab === 'map' && links) return <>{strip}<ServiceMapWeb links={links} target={{ kind: 'service', clientId: target.clientId, serviceId }} /></>;
  return (
    <>
      {strip}
      {tab === 'reports' ? <CreateReportButton onPress={onCreateReport} /> : null}
      {tab === 'reports' && seesMoney ? <ReportAction target={target} serviceId={serviceId} onAnswered={onReported} /> : null}
      <TabBody detail={detail} tab={listTab} onOpen={openRow} onOpenFile={viewer.open} />
      {tab === 'orders' ? <OrphanDispatches detail={detail} onOpen={openDispatch} onOpenFile={viewer.open} /> : null}
      {viewer.viewer}
      {sheet ? <RecordSheetWeb sheet={sheet} onClose={close} onOpenFile={viewer.open} pdf={sheet.pdfOnDemand ? { asking: reportPdf.asking, message: reportPdf.message, readyUrl: reportPdf.readyUrl, onAsk: () => void reportPdf.ask(sheet.pdfOnDemand!) } : undefined} onOpenRelated={openDispatch} action={orderLinkAction(links, top, target)} /> : null}
      {more ? <p className="text-center text-[12px] text-on-surface-variant">{`${more} · el resto está en el Portal`}</p> : null}
      {detail.service.url ? <PortalLink url={detail.service.url} label="Abrir en el Portal" testId="abrir-servicio-portal" /> : null}
    </>
  );
}

type ServiceDetailProps = { target: ServiceAskTarget; chatId: string; service: SpaceClientService; seesMoney: boolean; onBack: () => void; links?: ChannelLinks; /** Opens on that order's sheet: an order's card in the chat sent here. */ startOrderId?: string ; /** Its Drive joins the tabs (José 06/11). */ seesDrive?: boolean; /** A member an admin gave only the Drive. */ driveOnly?: boolean; onToChat?: () => void };

/** José 06/11: an open service takes the whole conversation, and this is the way back to the chat. */
function ServiceCrumbs(props: { service: string; onBack: () => void; onToChat?: () => void }) {
  return (
    <nav aria-label="Ruta" data-testid="ruta-servicio" className="flex min-w-0 items-center gap-1.5 text-sm">
      {props.onToChat ? <button type="button" data-testid="volver-al-chat" onClick={props.onToChat} className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary"><ChevronLeft size={16} /> Chat</button> : null}
      {props.onToChat ? <ChevronRight size={14} className="shrink-0 text-on-surface-variant" /> : null}
      <button type="button" data-testid="volver-a-servicios" onClick={props.onBack} className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary">{props.onToChat ? null : <ChevronLeft size={16} />} Servicios</button>
      <ChevronRight size={14} className="shrink-0 text-on-surface-variant" />
      <span className="min-w-0 truncate text-on-surface-variant">{props.service}</span>
    </nav>
  );
}

/**
 * A client's service as an expediente (José 30/10: there was no way to see a
 * service's reports, orders and dispatches; design f-04): its head, then
 * Pedidos · Informes · Drive, each order with its dispatches inside (José
 * 01/11). Asked when it opens.
 */
export function ServiceDetailWeb(props: ServiceDetailProps) {
  if (!props.driveOnly) return <ServiceRecordsDetail {...props} />;
  return (
    <div data-testid="detalle-servicio" className="mx-auto flex max-w-3xl flex-col gap-3">
      <ServiceCrumbs service={props.service.name} onBack={props.onBack} onToChat={props.onToChat} />
      <ServiceHead service={props.service} detail={null} />
      <ServiceDriveWeb target={props.target} service={props.service} chatId={props.chatId} />
    </div>
  );
}

function ServiceRecordsDetail(props: ServiceDetailProps) {
  // After a report the detail is asked again, keeping the open tab (agentes 31/10).
  const [round, setRound] = useState(0);
  const askAgain = useCallback(() => setRound((count) => count + 1), []);
  const answer = useServiceAsk('detail', props.target, props.service.id, round);
  // José 05/11: a field report is filled here, not in Portal's public page (spec INFORMES-DESDE-LILACHAT); it takes the detail's place.
  const [picker, setPicker] = useState(false);
  const [report, setReport] = useState<{ type: string; reportId?: string } | null>(null);
  // Back from the report, the detail opens on Informes, where it was.
  const [startTab, setStartTab] = useState<DetailTabKey>('orders');
  const portalUrl = answer?.ok ? answer.value.service.url : undefined;
  const closeReport = useCallback((changed: boolean) => {
    setReport(null);
    setStartTab('reports');
    if (changed) askAgain();
  }, [askAgain]);
  if (report) return <ReportDocumentWeb target={props.target} chatId={props.chatId} service={props.service} type={report.type} {...(report.reportId ? { reportId: report.reportId } : {})} portalUrl={portalUrl} onClose={closeReport} />;
  return (
    <div data-testid="detalle-servicio" className="mx-auto flex max-w-3xl flex-col gap-3">
      <ServiceCrumbs service={props.service.name} onBack={props.onBack} onToChat={props.onToChat} />
      <ServiceHead service={props.service} detail={answer?.ok ? answer.value : null} />
      {answer === null ? <div data-testid="detalle-cargando" className="h-48 animate-pulse rounded-xl bg-surface" /> : null}
      {answer?.ok ? <DetailTabs onContinueReport={setReport} detail={answer.value} target={props.target} service={props.service} chatId={props.chatId} seesDrive={Boolean(props.seesDrive)} links={props.links} seesMoney={props.seesMoney} onReported={askAgain} onCreateReport={() => setPicker(true)} startTab={startTab} startOrderId={startTab === 'orders' ? props.startOrderId : undefined} /> : null}
      {picker ? <CreateReportDialog portalUrl={portalUrl} onPick={(code) => { setPicker(false); setReport({ type: code }); }} onClose={() => setPicker(false)} /> : null}
      {answer && !answer.ok ? (
        <div data-testid="detalle-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-sm">
          <p className="mb-2 font-semibold">{answer.message}</p>
          {answer.portalUrl ? <PortalLink url={answer.portalUrl} label="Abrir el servicio en el Portal" testId="detalle-fallo-portal" /> : null}
          {answer.offline ? <button type="button" data-testid="crear-informe-sin-senal" onClick={() => setPicker(true)} className="mt-2 h-11 w-full rounded-xl border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">Crear informe</button> : null}
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useState } from 'react';
import { ChevronLeft, ExternalLink, FileText } from 'lucide-react';
import { CLIENT_SERVICE_STATUS_LABELS, DETAIL_EMPTY, serviceStageLine, detailRows, detailSheet, detailTabs, invoicesOf, moreInPortal, orphanDispatchesOf, reportGroups, type DetailRow, type ChannelLinks, type DetailTabKey, type ServiceDetail, type SpaceClientService } from '@lilachat/shared';
import { usePortalFileViewer } from './PortalFileViewer';
import type { OpenSheetFile } from './RecordSheetWeb';
import { RecordSheetWeb } from './RecordSheetWeb';
import { RegisterPaymentWeb } from './RegisterPaymentWeb';
import { ServiceBillingWeb } from './ServiceBillingWeb';
import { ServiceStagesWeb } from './ServiceStagesWeb';
import { DETAIL_TONE, STATUS_TONE } from './tones';
import { useReportPdf } from './useReportPdf';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';

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

/** Above the tab (José 31/10): «Registrar pago» in Cobranza; «Generar informe de servicio» in Informes while Portal's tool exists. */
function TabActions({ tab, links, target, serviceId, onPaid }: { tab: DetailTabKey; links?: ChannelLinks; target: ServiceAskTarget; serviceId: string; onPaid: () => void }) {
  if (tab === 'billing') return <RegisterPaymentWeb jwt={target.jwt} spaceId={target.spaceId} serviceId={serviceId} onPaid={onPaid} />;
  if (tab !== 'reports' || !links?.can('serviceReport')) return null;
  return (
    <button type="button" data-testid="generar-informe-servicio" onClick={() => links.open({ kind: 'serviceReport', clientId: target.clientId, serviceId })} className="flex h-11 w-full items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-left text-sm font-semibold text-primary hover:bg-primary/15">
      <FileText size={16} /> Generar informe de servicio
    </button>
  );
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

/** The open tab's body: «Cobranza» has its own view; the reports go by day; the rest, a row each. */
function TabBody({ detail, tab, onOpen, onOpenFile }: { detail: ServiceDetail; tab: DetailTabKey; onOpen: (id: string) => void; onOpenFile: OpenSheetFile }) {
  if (tab === 'billing' && detail.billing) return <ServiceBillingWeb billing={detail.billing} invoices={invoicesOf(detail)} onOpenFile={onOpenFile} />;
  const rows = detailRows(detail, tab);
  return (
    <ul className="divide-y divide-outline/10 overflow-hidden rounded-xl border border-outline/15 bg-surface">
      {!rows.length ? <li className="p-4 text-sm text-on-surface-variant">{DETAIL_EMPTY[tab]}</li> : tab === 'reports' ? <ReportDays detail={detail} onOpen={onOpen} onOpenFile={onOpenFile} /> : rows.map((row) => <RowView key={row.id} row={row} onOpen={onOpen} onOpenFile={onOpenFile} />)}
    </ul>
  );
}

function DetailTabs({ detail, target, serviceId, links, onPaid }: { detail: ServiceDetail; target: ServiceAskTarget; serviceId: string; links?: ChannelLinks; onPaid: () => void }) {
  // José 30/10 night: Cotizaciones and Cobranza first; it opens on the first one that came.
  const [tab, setTab] = useState<DetailTabKey>(() => detailTabs(detail)[0]?.key ?? 'orders');
  const viewer = usePortalFileViewer();
  // An order's sheet opens its dispatches on top (José 01/11); closing goes back one.
  const [opened, setOpened] = useState<OpenSheet[]>([]);
  const shown = detailRows(detail, tab).length;
  const more = tab === 'billing' ? null : moreInPortal(shown, detail.totals[tab] ?? shown);
  const top = opened.at(-1);
  const sheet = top ? detailSheet(detail, top.tab, top.id) : null;
  const reportPdf = useReportPdf(target, serviceId);
  const openRow = (id: string) => setOpened([{ tab, id }]);
  const openDispatch = (id: string) => setOpened((before) => [...before, { tab: 'dispatches', id }]);
  const close = () => {
    reportPdf.stop();
    setOpened((before) => before.slice(0, -1));
  };
  return (
    <>
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-outline/15 bg-surface p-1">
        {detailTabs(detail).map((one) => (
          <button key={one.key} type="button" role="tab" aria-selected={tab === one.key} data-testid={`pestana-detalle-${one.key}`} onClick={(event) => { setTab(one.key); event.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }} className={`h-9 shrink-0 rounded-lg px-3 text-sm ${tab === one.key ? 'bg-primary font-semibold text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{one.label}</button>
        ))}
      </div>
      <TabActions tab={tab} links={links} target={target} serviceId={serviceId} onPaid={onPaid} />
      <TabBody detail={detail} tab={tab} onOpen={openRow} onOpenFile={viewer.open} />
      {tab === 'orders' ? <OrphanDispatches detail={detail} onOpen={openDispatch} onOpenFile={viewer.open} /> : null}
      {viewer.viewer}
      {sheet ? <RecordSheetWeb sheet={sheet} onClose={close} onOpenFile={viewer.open} pdf={sheet.pdfOnDemand ? { asking: reportPdf.asking, message: reportPdf.message, readyUrl: reportPdf.readyUrl, onAsk: () => void reportPdf.ask(sheet.pdfOnDemand!) } : undefined} onOpenRelated={openDispatch} action={orderLinkAction(links, top, target)} /> : null}
      {more ? <p className="text-center text-[12px] text-on-surface-variant">{`${more} · el resto está en el Portal`}</p> : null}
      {detail.service.url ? <PortalLink url={detail.service.url} label="Abrir en el Portal" testId="abrir-servicio-portal" /> : null}
    </>
  );
}

/**
 * A client's service as an expediente (José 30/10: there was no way to see a
 * service's reports, orders and dispatches; design f-04): its head, then
 * Pedidos · Informes with Portal's counts, each order with its dispatches
 * inside (José 01/11). Asked when it opens.
 */
export function ServiceDetailWeb(props: { target: ServiceAskTarget; service: SpaceClientService; onBack: () => void; links?: ChannelLinks }) {
  // After a payment the detail is asked again, keeping the open tab (agentes 31/10).
  const [round, setRound] = useState(0);
  const askAgain = useCallback(() => setRound((count) => count + 1), []);
  const answer = useServiceAsk('detail', props.target, props.service.id, round);
  return (
    <div data-testid="detalle-servicio" className="mx-auto flex max-w-3xl flex-col gap-3">
      <button type="button" data-testid="volver-a-servicios" onClick={props.onBack} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-primary"><ChevronLeft size={16} /> Servicios</button>
      <ServiceHead service={props.service} detail={answer?.ok ? answer.value : null} />
      {answer === null ? <div data-testid="detalle-cargando" className="h-48 animate-pulse rounded-xl bg-surface" /> : null}
      {answer?.ok ? <DetailTabs detail={answer.value} target={props.target} serviceId={props.service.id} links={props.links} onPaid={askAgain} /> : null}
      {answer && !answer.ok ? (
        <div data-testid="detalle-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-sm">
          <p className="mb-2 font-semibold">{answer.message}</p>
          {answer.portalUrl ? <PortalLink url={answer.portalUrl} label="Abrir el servicio en el Portal" testId="detalle-fallo-portal" /> : null}
        </div>
      ) : null}
    </div>
  );
}

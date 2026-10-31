import { useState } from 'react';
import { ChevronLeft, ExternalLink, FileText } from 'lucide-react';
import { CLIENT_SERVICE_STATUS_LABELS, DETAIL_EMPTY, serviceStageLine, detailRows, detailSheet, detailTabs, invoicesOf, moreInPortal, orderGuidesOf, reportGroups, type DetailRow, type DetailTabKey, type ServiceDetail, type SheetFile, type SpaceClientService } from '@lilachat/shared';
import { usePortalFileViewer } from './PortalFileViewer';
import type { OpenSheetFile } from './RecordSheetWeb';
import { RecordSheetWeb } from './RecordSheetWeb';
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

/** A whole-order guide (José 30/10 night: «¿las guías deberían ir en despachos?»): at the top of Despachos. */
function OrderGuides({ guides, onOpenFile }: { guides: SheetFile[]; onOpenFile: OpenSheetFile }) {
  return (
    <section data-testid="guias-del-pedido" className="rounded-xl border border-outline/15 bg-surface px-4 py-2">
      <p className="py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Guías del pedido</p>
      {guides.map((guide) => <button key={guide.url} type="button" onClick={() => onOpenFile({ url: guide.url, name: guide.label })} className="flex min-h-[40px] w-full items-center gap-2 text-left text-sm font-semibold text-primary hover:underline"><FileText size={15} /> {guide.label}</button>)}
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

function DetailTabs({ detail, target, serviceId }: { detail: ServiceDetail; target: ServiceAskTarget; serviceId: string }) {
  // José 30/10 night: Cotizaciones and Cobranza first; it opens on the first one that came.
  const [tab, setTab] = useState<DetailTabKey>(() => detailTabs(detail)[0]?.key ?? 'orders');
  const viewer = usePortalFileViewer();
  const guides = tab === 'dispatches' ? orderGuidesOf(detail) : [];
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = detailRows(detail, tab);
  const more = tab === 'billing' ? null : moreInPortal(rows.length, detail.totals[tab] ?? rows.length);
  const sheet = openId ? detailSheet(detail, tab, openId) : null;
  const reportPdf = useReportPdf(target, serviceId);
  const close = () => {
    reportPdf.stop();
    setOpenId(null);
  };
  return (
    <>
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-outline/15 bg-surface p-1">
        {detailTabs(detail).map((one) => (
          <button key={one.key} type="button" role="tab" aria-selected={tab === one.key} data-testid={`pestana-detalle-${one.key}`} onClick={(event) => { setTab(one.key); event.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }} className={`h-9 shrink-0 rounded-lg px-3 text-sm ${tab === one.key ? 'bg-primary font-semibold text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{one.label}</button>
        ))}
      </div>
      {guides.length ? <OrderGuides guides={guides} onOpenFile={viewer.open} /> : null}
      {tab === 'billing' && detail.billing ? <ServiceBillingWeb billing={detail.billing} invoices={invoicesOf(detail)} onOpenFile={viewer.open} /> : (
        <ul className="divide-y divide-outline/10 overflow-hidden rounded-xl border border-outline/15 bg-surface">
          {!rows.length ? <li className="p-4 text-sm text-on-surface-variant">{DETAIL_EMPTY[tab]}</li> : tab === 'reports' ? <ReportDays detail={detail} onOpen={setOpenId} onOpenFile={viewer.open} /> : rows.map((row) => <RowView key={row.id} row={row} onOpen={setOpenId} onOpenFile={viewer.open} />)}
        </ul>
      )}
      {viewer.viewer}
      {sheet ? <RecordSheetWeb sheet={sheet} onClose={close} onOpenFile={viewer.open} pdf={sheet.pdfOnDemand ? { asking: reportPdf.asking, message: reportPdf.message, readyUrl: reportPdf.readyUrl, onAsk: () => void reportPdf.ask(sheet.pdfOnDemand!) } : undefined} /> : null}
      {more ? <p className="text-center text-[12px] text-on-surface-variant">{`${more} · el resto está en el Portal`}</p> : null}
      {detail.service.url ? <PortalLink url={detail.service.url} label="Abrir en el Portal" testId="abrir-servicio-portal" /> : null}
    </>
  );
}

/**
 * A client's service as an expediente (José 30/10: there was no way to see a
 * service's reports, orders and dispatches; design f-04): its head, then
 * Pedidos · Despachos · Informes with Portal's counts. Asked when it opens.
 */
export function ServiceDetailWeb(props: { target: ServiceAskTarget; service: SpaceClientService; onBack: () => void }) {
  const answer = useServiceAsk('detail', props.target, props.service.id);
  return (
    <div data-testid="detalle-servicio" className="mx-auto flex max-w-3xl flex-col gap-3">
      <button type="button" data-testid="volver-a-servicios" onClick={props.onBack} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-primary"><ChevronLeft size={16} /> Servicios</button>
      <ServiceHead service={props.service} detail={answer?.ok ? answer.value : null} />
      {answer === null ? <div data-testid="detalle-cargando" className="h-48 animate-pulse rounded-xl bg-surface" /> : null}
      {answer?.ok ? <DetailTabs detail={answer.value} target={props.target} serviceId={props.service.id} /> : null}
      {answer && !answer.ok ? (
        <div data-testid="detalle-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-sm">
          <p className="mb-2 font-semibold">{answer.message}</p>
          {answer.portalUrl ? <PortalLink url={answer.portalUrl} label="Abrir el servicio en el Portal" testId="detalle-fallo-portal" /> : null}
        </div>
      ) : null}
    </div>
  );
}

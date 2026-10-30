import { useState } from 'react';
import { ChevronLeft, ExternalLink, FileText } from 'lucide-react';
import { CLIENT_SERVICE_STATUS_LABELS, DETAIL_EMPTY, serviceStageLine, detailRows, detailSheet, detailTabs, moreInPortal, type DetailRow, type DetailTabKey, type ServiceDetail, type SpaceClientService } from '@lilachat/shared';
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
function ServiceHead({ service }: { service: SpaceClientService }) {
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
    </section>
  );
}

/** José 30/10: the row opens its sheet inside Lilachat; the file opens straight from lila, not in Portal. */
function RowView({ row, onOpen }: { row: DetailRow; onOpen: (id: string) => void }) {
  return (
    <li data-testid={`fila-${row.id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
      <button type="button" onClick={() => onOpen(row.id)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold hover:underline">{row.title}</p>
        {row.line ? <p className="truncate text-[12px] text-on-surface-variant">{row.line}</p> : null}
      </button>
      {row.file ? (
        <a href={row.file.url} target="_blank" rel="noreferrer" data-testid={`archivo-${row.id}`} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-primary hover:underline"><FileText size={14} /> {row.file.label}</a>
      ) : null}
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[row.status.tone]}`}>{row.status.label}</span>
    </li>
  );
}

function DetailTabs({ detail, target, serviceId }: { detail: ServiceDetail; target: ServiceAskTarget; serviceId: string }) {
  const [tab, setTab] = useState<DetailTabKey>('orders');
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
      <ServiceStagesWeb detail={detail} />
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-outline/15 bg-surface p-1">
        {detailTabs(detail).map((one) => (
          <button key={one.key} type="button" role="tab" aria-selected={tab === one.key} data-testid={`pestana-detalle-${one.key}`} onClick={(event) => { setTab(one.key); event.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }} className={`h-9 shrink-0 rounded-lg px-3 text-sm ${tab === one.key ? 'bg-primary font-semibold text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{one.label}</button>
        ))}
      </div>
      {tab === 'billing' && detail.billing ? <ServiceBillingWeb billing={detail.billing} /> : (
        <ul className="divide-y divide-outline/10 overflow-hidden rounded-xl border border-outline/15 bg-surface">
          {rows.length ? rows.map((row) => <RowView key={row.id} row={row} onOpen={setOpenId} />) : <li className="p-4 text-sm text-on-surface-variant">{DETAIL_EMPTY[tab]}</li>}
        </ul>
      )}
      {sheet ? <RecordSheetWeb sheet={sheet} onClose={close} pdf={sheet.pdfOnDemand ? { asking: reportPdf.asking, message: reportPdf.message, readyUrl: reportPdf.readyUrl, onAsk: () => void reportPdf.ask(sheet.pdfOnDemand!) } : undefined} /> : null}
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
      <ServiceHead service={props.service} />
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

import { Receipt } from 'lucide-react';
import { billingSummary, dayOf, dueStatus, longDayOf, moneyOf, type BillingItem, type BillingPayment, type ServiceBilling } from '@lilachat/shared';
import { DETAIL_TONE } from './tones';

const Kicker = ({ children }: { children: string }) => <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{children}</p>;
const Pill = ({ label, tone }: { label: string; tone: keyof typeof DETAIL_TONE }) => <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[tone]}`}>{label}</span>;

function PaymentCondition({ billing, paidOff }: { billing: ServiceBilling; paidOff: boolean }) {
  const due = billing.isCredit && billing.dueAt && !paidOff ? dueStatus(billing.dueAt, new Date()) : null;
  return (
    <section data-testid="condicion-de-pago" className={`flex items-center gap-3 rounded-xl border border-outline/15 bg-surface p-4 ${billing.isCredit ? 'border-l-[3px] border-l-warning' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><Kicker>Condición de pago</Kicker><Pill label={billing.isCredit ? 'Crédito' : 'Contado'} tone={billing.isCredit ? 'warn' : 'neutral'} /></div>
        <p className="mt-1.5 font-semibold">{billing.isCredit ? (billing.dueAt ? `Vence el ${longDayOf(billing.dueAt)}` : 'Sin fecha de vencimiento') : 'Al contado'}</p>
      </div>
      {due ? <span data-testid="vencimiento" className={`rounded-lg border px-2.5 py-1 text-[13px] font-bold ${DETAIL_TONE[due.tone]}`}>{due.label}</span> : null}
    </section>
  );
}

const Figure = (props: { label: string; value?: number; tone: string }) => (
  <div className="min-w-0">
    <p className={`text-[12px] ${props.tone}`}>{props.label}</p>
    <p className={`truncate text-base font-bold tabular-nums md:text-lg ${props.tone}`}>{props.value === undefined ? '—' : moneyOf(props.value)}</p>
  </div>
);

function CollectionState({ billing }: { billing: ServiceBilling }) {
  const summary = billingSummary(billing);
  return (
    <section data-testid="estado-de-cobranza" className="rounded-xl border border-outline/15 bg-surface p-4">
      <div className="flex items-center justify-between"><Kicker>Estado de cobranza</Kicker>{summary.progress !== undefined ? <span className="font-mono text-[13px] font-bold text-primary">{`${summary.progress} % cobrado`}</span> : null}</div>
      <div className="mt-3 grid grid-cols-3 gap-3 divide-x divide-outline/10">
        <Figure label="Total" value={billing.total} tone="text-on-surface" />
        <div className="pl-3"><Figure label="Cobrado" value={billing.collected} tone="text-en-linea" /></div>
        <div className="pl-3"><Figure label="Por cobrar" value={summary.pending} tone="text-warning" /></div>
      </div>
      {summary.progress !== undefined ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${summary.progress}%` }} /></div> : null}
      {summary.detraction !== undefined ? <p className="mt-3 flex justify-between border-t border-outline/10 pt-3 text-sm"><span className="text-on-surface-variant">{`Detracción ${summary.detractionPercent} %`}</span><span className="font-semibold tabular-nums">{moneyOf(summary.detraction)}</span></p> : null}
    </section>
  );
}

function Items({ items }: { items: BillingItem[] }) {
  if (!items.length) return null;
  return (
    <section data-testid="partidas" className="rounded-xl border border-outline/15 bg-surface p-4">
      <div className="flex justify-between"><Kicker>Partidas del servicio</Kicker><span className="text-[12px] text-on-surface-variant">{`${items.length} ${items.length === 1 ? 'partida' : 'partidas'}`}</span></div>
      <ul className="mt-2 divide-y divide-outline/10">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex items-start gap-3 py-2.5">
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.name}</p>{item.total !== undefined ? <p className="text-[13px] tabular-nums text-on-surface-variant">{moneyOf(item.total)}</p> : null}</div>
            <Pill label={item.invoiced ? 'Facturada' : 'Por facturar'} tone={item.invoiced ? 'ok' : 'neutral'} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Payments({ payments }: { payments: BillingPayment[] }) {
  return (
    <section data-testid="pagos" className="rounded-xl border border-outline/15 bg-surface p-4">
      <Kicker>Pagos</Kicker>
      {payments.length ? (
        <ul className="mt-2 divide-y divide-outline/10">
          {payments.map((payment, index) => (
            <li key={`${payment.date}-${index}`} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1"><p className="font-bold tabular-nums">{moneyOf(payment.amount)}</p><p className="truncate text-[12px] text-on-surface-variant">{[dayOf(payment.date), payment.method, payment.reference].filter(Boolean).join(' · ')}</p></div>
              {payment.voucherUrl ? <a href={payment.voucherUrl} target="_blank" rel="noreferrer" data-testid={`comprobante-${index}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"><Receipt size={14} /> Comprobante</a> : null}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-on-surface-variant">Todavía no hay pagos registrados.</p>}
    </section>
  );
}

/** «Cobranza» of a service (design f-05): only reaches whoever may see it (admins, or marked in the channel). */
export function ServiceBillingWeb({ billing }: { billing: ServiceBilling }) {
  return (
    <div data-testid="cobranza" className="flex flex-col gap-3">
      <PaymentCondition billing={billing} paidOff={billingSummary(billing).paidOff} />
      <CollectionState billing={billing} />
      <Items items={billing.items} />
      <Payments payments={billing.payments} />
    </div>
  );
}

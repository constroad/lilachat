import { useState } from 'react';
import { accountSummary, amount, creditOrdersByUrgency, dayOf, dueStatus, moneyOf, quoteSheet, type AccountQuote, type ClientAccount, type CreditOrder } from '@lilachat/shared';
import { RecordSheetWeb } from './RecordSheetWeb';
import { usePortalFileViewer } from './PortalFileViewer';
import { DETAIL_TONE } from './tones';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';

const Kicker = ({ children }: { children: string }) => <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{children}</p>;
const Pill = ({ label, tone }: { label: string; tone: keyof typeof DETAIL_TONE }) => <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[tone]}`}>{label}</span>;

function Summary({ account }: { account: ClientAccount }) {
  const summary = accountSummary(account, new Date());
  return (
    <section data-testid="resumen-cuenta" className="rounded-xl border border-outline/15 border-t-[3px] border-t-primary bg-surface p-4">
      <div className="flex items-center justify-between"><Kicker>Cuenta del cliente</Kicker><Pill label={`${summary.onCredit} al crédito`} tone="neutral" /></div>
      <div className="mt-3 grid grid-cols-2 divide-x divide-outline/10">
        <div><p className="text-[12px] text-on-surface-variant">Total por cobrar</p><p className="text-xl font-bold tabular-nums">{summary.pending === undefined ? '—' : moneyOf(summary.pending)}</p></div>
        <div className="pl-4"><p className="text-[12px] text-error">Monto vencido</p><p className="text-xl font-bold tabular-nums text-error">{moneyOf(summary.overdue)}</p></div>
      </div>
    </section>
  );
}

function CreditRow({ order }: { order: CreditOrder }) {
  const due = order.dueAt && order.pending ? dueStatus(order.dueAt, new Date()) : null;
  return (
    <li data-testid={`credito-${order.id}`} className={`py-3 ${due?.tone === 'error' ? 'border-l-[3px] border-l-error pl-3' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{order.product ?? 'Pedido'}</p><p className="text-[12px] text-on-surface-variant">{[amount(order.quantity, order.unit), order.date && dayOf(order.date), order.total !== undefined ? `Total ${moneyOf(order.total)}` : undefined].filter(Boolean).join(' · ')}</p></div>
        {due ? <Pill label={due.label} tone={due.tone} /> : <Pill label={order.status.label} tone={order.status.tone} />}
      </div>
      {order.pending !== undefined ? <p className={`mt-1 text-right font-bold tabular-nums ${due?.tone === 'error' ? 'text-error' : ''}`}>{`Debe ${moneyOf(order.pending)}`}</p> : null}
    </li>
  );
}

function AccountBody({ account }: { account: ClientAccount }) {
  const [quote, setQuote] = useState<AccountQuote | null>(null);
  const viewer = usePortalFileViewer();
  const credit = account.creditOrders;
  if (!credit && !account.quotes) return <p className="pt-6 text-center text-sm text-on-surface-variant">No tienes permiso para ver la cuenta de este cliente.</p>;
  return (
    <>
      {credit ? <Summary account={account} /> : null}
      {credit ? (
        <section className="rounded-xl border border-outline/15 bg-surface px-4 pt-3">
          <Kicker>Pedidos al crédito</Kicker>
          {credit.length ? <ul className="divide-y divide-outline/10">{creditOrdersByUrgency(credit, new Date()).map((order) => <CreditRow key={order.id} order={order} />)}</ul> : <p className="py-3 text-sm text-on-surface-variant">Sin pedidos al crédito.</p>}
        </section>
      ) : null}
      {account.quotes ? (
        <section className="rounded-xl border border-outline/15 bg-surface px-4 pt-3">
          <Kicker>{`Cotizaciones · ${account.totals.quotes ?? account.quotes.length}`}</Kicker>
          {account.quotes.length ? (
            <ul className="divide-y divide-outline/10">
              {account.quotes.map((one) => (
                <li key={one.id}>
                  <button type="button" data-testid={`cotizacion-${one.id}`} onClick={() => setQuote(one)} className="flex min-h-[52px] w-full items-center gap-3 py-2.5 text-left hover:bg-background">
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{one.code ? `Cotización ${one.code}` : 'Cotización'}</span><span className="block text-[12px] text-on-surface-variant">{[one.total !== undefined ? moneyOf(one.total) : undefined, one.date && dayOf(one.date), one.serviceId ? undefined : 'sin servicio'].filter(Boolean).join(' · ')}</span></span>
                    <Pill label={one.status.label} tone={one.status.tone} />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="py-3 text-sm text-on-surface-variant">Sin cotizaciones.</p>}
        </section>
      ) : null}
      {quote ? <RecordSheetWeb sheet={quoteSheet(quote)} onClose={() => setQuote(null)} onOpenFile={viewer.open} /> : null}
      {viewer.viewer}
    </>
  );
}

/**
 * «Cuenta» of a client's channel (José 30/10: where are the client's quotes;
 * design f-08): ALL its quotes and its orders on credit, overdue first.
 */
export function ClientAccountWeb(props: { target: ServiceAskTarget }) {
  const answer = useServiceAsk('account', props.target, props.target.clientId);
  return (
    <div data-testid="cuenta-cliente" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {answer === null ? <div data-testid="cuenta-cargando" className="h-40 animate-pulse rounded-xl bg-surface" /> : null}
        {answer?.ok ? <AccountBody account={answer.value} /> : null}
        {answer && !answer.ok ? <p data-testid="cuenta-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-sm font-semibold">{answer.message}</p> : null}
      </div>
    </div>
  );
}

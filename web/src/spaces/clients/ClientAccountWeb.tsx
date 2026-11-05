import { useCallback, useState } from 'react';
import { accountQuoteLine, accountServiceLine, accountSummary, byUrgency, collectionByService, creditOrderLine, dueStatus, moneyOf, quoteSheet, type AccountQuote, type CollectionRow, type SpaceClientService, type ClientAccount, type CreditOrder, type DetailStatus } from '@lilachat/shared';
import { ChevronRight } from 'lucide-react';
import { RecordSheetWeb } from './RecordSheetWeb';
import { ServiceCollectionWeb } from './ServiceCollectionWeb';
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

/** What is owed, with its due day when it has one: past due, it is marked in red. With `onOpen` the whole row opens. */
function DebtRow(props: { testId: string; title: string; line: string; dueAt?: string; pending?: number; status?: DetailStatus; onOpen?: () => void }) {
  const due = props.dueAt && props.pending ? dueStatus(props.dueAt, new Date()) : null;
  const body = (
    <>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{props.title}</p><p className="text-[12px] text-on-surface-variant">{props.line}</p></div>
        {due ? <Pill label={due.label} tone={due.tone} /> : props.status ? <Pill label={props.status.label} tone={props.status.tone} /> : null}
        {props.onOpen ? <ChevronRight size={16} className="shrink-0 text-on-surface-variant" /> : null}
      </div>
      {props.pending !== undefined ? <p className={`mt-1 text-right font-bold tabular-nums ${due?.tone === 'error' ? 'text-error' : ''}`}>{`Debe ${moneyOf(props.pending)}`}</p> : null}
    </>
  );
  return (
    <li data-testid={props.testId} className={`py-3 ${due?.tone === 'error' ? 'border-l-[3px] border-l-error pl-3' : ''}`}>
      {props.onOpen ? <button type="button" onClick={props.onOpen} className="block w-full text-left">{body}</button> : body}
    </li>
  );
}

const CreditRow = ({ order }: { order: CreditOrder }) => <DebtRow testId={`credito-${order.id}`} title={order.product ?? 'Pedido'} line={creditOrderLine(order, new Date())} dueAt={order.dueAt} pending={order.pending} status={order.status} />;

const ServiceRow = ({ service, onOpen }: { service: CollectionRow; onOpen: () => void }) => <DebtRow testId={`servicio-por-cobrar-${service.id}`} title={service.name} line={accountServiceLine(service)} dueAt={service.dueAt} pending={service.pending} onOpen={onOpen} />;

function AccountBody({ account, services, onOpenService }: { account: ClientAccount; services: readonly SpaceClientService[]; onOpenService: (service: CollectionRow) => void }) {
  const [quote, setQuote] = useState<AccountQuote | null>(null);
  const viewer = usePortalFileViewer();
  const credit = account.creditOrders;
  const collection = collectionByService(account.services, services, new Date());
  if (!credit && !account.services && !account.quotes) return <p className="pt-6 text-center text-sm text-on-surface-variant">No tienes permiso para ver la cuenta de este cliente.</p>;
  return (
    <>
      {credit || account.services ? <Summary account={account} /> : null}
      {collection.length ? (
        <section data-testid="servicios-por-cobrar" className="rounded-xl border border-outline/15 bg-surface px-4 pt-3">
          <Kicker>{`Cobranza por servicio · ${collection.length}`}</Kicker>
          <ul className="divide-y divide-outline/10">{collection.map((service) => <ServiceRow key={service.id} service={service} onOpen={() => onOpenService(service)} />)}</ul>
        </section>
      ) : null}
      {credit ? (
        <section className="rounded-xl border border-outline/15 bg-surface px-4 pt-3">
          <Kicker>Pedidos al crédito</Kicker>
          {credit.length ? <ul className="divide-y divide-outline/10">{byUrgency(credit, new Date()).map((order) => <CreditRow key={order.id} order={order} />)}</ul> : <p className="py-3 text-sm text-on-surface-variant">Sin pedidos al crédito.</p>}
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
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{one.code ? `Cotización ${one.code}` : 'Cotización'}</span><span className="block text-[12px] text-on-surface-variant">{accountQuoteLine(one, new Date())}</span></span>
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
 * design f-08): ALL its quotes, its orders on credit and, by service, its
 * collection, overdue first. The one place with money (José 05/11): a service
 * opens its Cobranza here, and «Servicios» carries none.
 */
export function ClientAccountWeb(props: { target: ServiceAskTarget; services: readonly SpaceClientService[] }) {
  const [round, setRound] = useState(0);
  const [opened, setOpened] = useState<CollectionRow | null>(null);
  const answer = useServiceAsk('account', props.target, props.target.clientId, round);
  const askAgain = useCallback(() => setRound((count) => count + 1), []);
  return (
    <div data-testid="cuenta-cliente" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {opened ? <ServiceCollectionWeb target={props.target} service={opened} onBack={() => setOpened(null)} onPaid={askAgain} /> : null}
        {!opened && answer === null ? <div data-testid="cuenta-cargando" className="h-40 animate-pulse rounded-xl bg-surface" /> : null}
        {!opened && answer?.ok ? <AccountBody account={answer.value} services={props.services} onOpenService={setOpened} /> : null}
        {!opened && answer && !answer.ok ? <p data-testid="cuenta-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-sm font-semibold">{answer.message}</p> : null}
      </div>
    </div>
  );
}

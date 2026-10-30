import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { accountSummary, amount, creditOrdersByUrgency, dayOf, dueStatus, moneyOf, quoteSheet, type AccountQuote, type ClientAccount, type CreditOrder } from '@lilachat/shared';
import { RecordSheet } from './RecordSheet';
import { DETAIL_TONE } from './tones';
import { useFileViewer } from './useFileViewer';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';

const Kicker = ({ children }: { children: string }) => <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{children}</Text>;
const Pill = ({ label, tone }: { label: string; tone: keyof typeof DETAIL_TONE }) => <Text className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[tone]}`}>{label}</Text>;

/** «Cuenta del cliente» (f-08): what is pending in all, what is overdue today and how many orders are on credit. */
function Summary({ account }: { account: ClientAccount }) {
  const summary = accountSummary(account, new Date());
  return (
    <View testID="resumen-cuenta" className="rounded-2xl border border-outline/15 border-t-[3px] border-t-primary bg-surface p-4">
      <View className="flex-row items-center justify-between"><Kicker>Cuenta del cliente</Kicker><Pill label={`${summary.onCredit} al crédito`} tone="neutral" /></View>
      <View className="mt-3 flex-row gap-3">
        <View className="min-w-0 flex-1"><Text className="text-[12px] text-on-surface-variant">Total por cobrar</Text><Text className="text-[20px] font-bold text-on-surface" adjustsFontSizeToFit numberOfLines={1}>{summary.pending === undefined ? '—' : moneyOf(summary.pending)}</Text></View>
        <View className="min-w-0 flex-1 border-l border-outline/10 pl-3"><Text className="text-[12px] text-error">Monto vencido</Text><Text className="text-[20px] font-bold text-error" adjustsFontSizeToFit numberOfLines={1}>{moneyOf(summary.overdue)}</Text></View>
      </View>
    </View>
  );
}

function CreditRow({ order }: { order: CreditOrder }) {
  const due = order.dueAt && order.pending ? dueStatus(order.dueAt, new Date()) : null;
  return (
    <View testID={`credito-${order.id}`} className={`border-t border-outline/10 py-3 ${due?.tone === 'error' ? 'border-l-[3px] border-l-error pl-3' : ''}`}>
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[14px] font-semibold text-on-surface">{order.product ?? 'Pedido'}</Text>
          <Text className="mt-0.5 text-[12px] text-on-surface-variant">{[amount(order.quantity, order.unit), order.date && dayOf(order.date), order.total !== undefined ? `Total ${moneyOf(order.total)}` : undefined].filter(Boolean).join(' · ')}</Text>
        </View>
        {due ? <Pill label={due.label} tone={due.tone} /> : <Pill label={order.status.label} tone={order.status.tone} />}
      </View>
      {order.pending !== undefined ? <Text className={`mt-1 text-right text-[15px] font-bold ${due?.tone === 'error' ? 'text-error' : 'text-on-surface'}`}>{`Debe ${moneyOf(order.pending)}`}</Text> : null}
    </View>
  );
}

function QuoteRow(props: { quote: AccountQuote; onOpen: () => void }) {
  const { quote } = props;
  return (
    <Pressable testID={`cotizacion-${quote.id}`} onPress={props.onOpen} className="min-h-[56px] flex-row items-center gap-3 border-t border-outline/10 py-2.5">
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-semibold text-on-surface">{quote.code ? `Cotización ${quote.code}` : 'Cotización'}</Text>
        <Text className="mt-0.5 text-[12px] text-on-surface-variant">{[quote.total !== undefined ? moneyOf(quote.total) : undefined, quote.date && dayOf(quote.date), quote.serviceId ? undefined : 'sin servicio'].filter(Boolean).join(' · ')}</Text>
      </View>
      <Pill label={quote.status.label} tone={quote.status.tone} />
    </Pressable>
  );
}

function AccountBody({ account }: { account: ClientAccount }) {
  const [quote, setQuote] = useState<AccountQuote | null>(null);
  const files = useFileViewer();
  const credit = account.creditOrders;
  if (!credit && !account.quotes) return <Text className="pt-6 text-center text-[14px] text-on-surface-variant">No tienes permiso para ver la cuenta de este cliente.</Text>;
  return (
    <>
      {credit ? <Summary account={account} /> : null}
      {credit ? (
        <View className="rounded-2xl border border-outline/15 bg-surface px-4 pt-3">
          <Kicker>Pedidos al crédito</Kicker>
          {credit.length ? creditOrdersByUrgency(credit, new Date()).map((order) => <CreditRow key={order.id} order={order} />) : <Text className="py-3 text-[14px] text-on-surface-variant">Sin pedidos al crédito.</Text>}
        </View>
      ) : null}
      {account.quotes ? (
        <View className="rounded-2xl border border-outline/15 bg-surface px-4 pt-3">
          <Kicker>{`Cotizaciones · ${account.totals.quotes ?? account.quotes.length}`}</Kicker>
          {account.quotes.length ? account.quotes.map((one) => <QuoteRow key={one.id} quote={one} onOpen={() => setQuote(one)} />) : <Text className="py-3 text-[14px] text-on-surface-variant">Sin cotizaciones.</Text>}
        </View>
      ) : null}
      <RecordSheet sheet={quote ? quoteSheet(quote) : null} onClose={() => setQuote(null)} onOpenFile={files.open} />
      {files.viewer}
    </>
  );
}

/**
 * «Cuenta» of a client's channel (José 30/10: where are the client's quotes;
 * design f-08): ALL its quotes, also those with no service, and its orders on
 * credit, overdue first. Asked when it opens; what Portal does not send is
 * what that person may not see.
 */
export function ClientAccountPanel(props: { target: ServiceAskTarget }) {
  const answer = useServiceAsk('account', props.target, props.target.clientId);
  return (
    <ScrollView testID="cuenta-cliente" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      {answer === null ? <View testID="cuenta-cargando" className="h-40 rounded-2xl bg-surface-variant" /> : null}
      {answer?.ok ? <AccountBody account={answer.value} /> : null}
      {answer && !answer.ok ? <Text testID="cuenta-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-[15px] font-semibold text-on-surface">{answer.message}</Text> : null}
    </ScrollView>
  );
}

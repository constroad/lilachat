import { Pressable, Text, View } from 'react-native';
import { Receipt } from 'lucide-react-native';
import { billingSummary, dayOf, dueStatus, longDayOf, moneyOf, type BillingItem, type BillingPayment, type ServiceBilling as Billing } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import type { ViewableFile } from './fileViewer';
import { DETAIL_TONE } from './tones';

const Kicker = ({ children }: { children: string }) => <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{children}</Text>;
const Card = ({ children, testID }: { children: React.ReactNode; testID: string }) => <View testID={testID} className="rounded-2xl border border-outline/15 bg-surface p-4">{children}</View>;
const Pill = ({ label, tone }: { label: string; tone: keyof typeof DETAIL_TONE }) => <Text className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[tone]}`}>{label}</Text>;

/** «Condición de pago» (f-05): credit with its due day and how far it is, or cash. */
function PaymentCondition({ billing, paidOff }: { billing: Billing; paidOff: boolean }) {
  const due = billing.isCredit && billing.dueAt && !paidOff ? dueStatus(billing.dueAt, new Date()) : null;
  return (
    <View testID="condicion-de-pago" className={`flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface p-4 ${billing.isCredit ? 'border-l-[3px] border-l-warning' : ''}`}>
      <View className="min-w-0 flex-1 gap-1.5">
        <View className="flex-row items-center gap-2">
          <Kicker>Condición de pago</Kicker>
          <Pill label={billing.isCredit ? 'Crédito' : 'Contado'} tone={billing.isCredit ? 'warn' : 'neutral'} />
        </View>
        <Text className="text-[15px] font-semibold text-on-surface">{billing.isCredit ? (billing.dueAt ? `Vence el ${longDayOf(billing.dueAt)}` : 'Sin fecha de vencimiento') : 'Al contado'}</Text>
      </View>
      {due ? <Text testID="vencimiento" className={`rounded-lg border px-2.5 py-1 text-[13px] font-bold ${DETAIL_TONE[due.tone]}`}>{due.label}</Text> : null}
    </View>
  );
}

function Figure(props: { label: string; value?: number; tone: string }) {
  return (
    <View className="min-w-0 flex-1">
      <Text className={`text-[12px] ${props.tone}`}>{props.label}</Text>
      <Text className={`text-[16px] font-bold ${props.tone}`} numberOfLines={1} adjustsFontSizeToFit>{props.value === undefined ? '—' : moneyOf(props.value)}</Text>
    </View>
  );
}

/** «Estado de cobranza»: total, collected, pending, the bar and the detraction. */
function CollectionState({ billing }: { billing: Billing }) {
  const summary = billingSummary(billing);
  return (
    <Card testID="estado-de-cobranza">
      <View className="flex-row items-center justify-between">
        <Kicker>Estado de cobranza</Kicker>
        {summary.progress !== undefined ? <Text className="text-[13px] font-bold text-primary">{`${summary.progress} % cobrado`}</Text> : null}
      </View>
      <View className="mt-3 flex-row gap-3">
        <Figure label="Total" value={billing.total} tone="text-on-surface" />
        <Figure label="Cobrado" value={billing.collected} tone="text-en-linea" />
        <Figure label="Por cobrar" value={summary.pending} tone="text-warning" />
      </View>
      {summary.progress !== undefined ? <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-background"><View className="h-full rounded-full bg-primary" style={{ width: `${summary.progress}%` }} /></View> : null}
      {summary.detraction !== undefined ? (
        <View className="mt-3 flex-row justify-between border-t border-outline/10 pt-3">
          <Text className="text-[14px] text-on-surface-variant">{`Detracción ${summary.detractionPercent} %`}</Text>
          <Text className="text-[14px] font-semibold text-on-surface">{moneyOf(summary.detraction)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function Items({ items }: { items: BillingItem[] }) {
  if (!items.length) return null;
  return (
    <Card testID="partidas">
      <View className="flex-row justify-between"><Kicker>Partidas del servicio</Kicker><Text className="text-[12px] text-on-surface-variant">{`${items.length} ${items.length === 1 ? 'partida' : 'partidas'}`}</Text></View>
      {items.map((item, index) => (
        <View key={`${item.name}-${index}`} className="mt-3 flex-row items-start gap-3 border-t border-outline/10 pt-3">
          <View className="min-w-0 flex-1">
            <Text className="text-[14px] font-semibold text-on-surface">{item.name}</Text>
            {item.total !== undefined ? <Text className="mt-0.5 text-[13px] text-on-surface-variant">{moneyOf(item.total)}</Text> : null}
          </View>
          <Pill label={item.invoiced ? 'Facturada' : 'Por facturar'} tone={item.invoiced ? 'ok' : 'neutral'} />
        </View>
      ))}
    </Card>
  );
}

function Payments(props: { payments: BillingPayment[]; onOpenFile: (file: ViewableFile) => void }) {
  const colors = useColores();
  return (
    <Card testID="pagos">
      <Kicker>Pagos</Kicker>
      {props.payments.length ? props.payments.map((payment, index) => (
        <View key={`${payment.date}-${index}`} className="mt-3 flex-row items-center gap-3 border-t border-outline/10 pt-3">
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-bold text-on-surface">{moneyOf(payment.amount)}</Text>
            <Text className="mt-0.5 text-[12px] text-on-surface-variant" numberOfLines={1}>{[dayOf(payment.date), payment.method, payment.reference].filter(Boolean).join(' · ')}</Text>
          </View>
          {payment.voucherUrl ? (
            <Pressable testID={`comprobante-${index}`} onPress={() => props.onOpenFile({ url: payment.voucherUrl!, name: `Comprobante ${dayOf(payment.date)}`, when: dayOf(payment.date) })} className="min-h-[44px] flex-row items-center gap-1">
              <Receipt size={15} color={colors.primary} />
              <Text className="text-[13px] font-semibold text-primary">Comprobante</Text>
            </Pressable>
          ) : null}
        </View>
      )) : <Text className="mt-2 text-[14px] text-on-surface-variant">Todavía no hay pagos registrados.</Text>}
    </Card>
  );
}

/** «Cobranza» of a service (design f-05): only reaches whoever may see it (admins, or marked in the channel). */
export function ServiceBilling(props: { billing: Billing; onOpenFile: (file: ViewableFile) => void }) {
  const { billing } = props;
  return (
    <View testID="cobranza" className="gap-3">
      <PaymentCondition billing={billing} paidOff={billingSummary(billing).paidOff} />
      <CollectionState billing={billing} />
      <Items items={billing.items} />
      <Payments payments={billing.payments} onOpenFile={props.onOpenFile} />
    </View>
  );
}

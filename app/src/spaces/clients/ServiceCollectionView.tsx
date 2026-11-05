import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { invoicesOf, PAYMENT_ACTION, serviceValuesOf, type CollectionRow } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { ServiceBilling } from './ServiceBilling';
import { SpaceActionButton } from './SpaceActionButton';
import { useFileViewer } from './useFileViewer';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';

/**
 * A service's «Cobranza», opened from «Cuenta» (José 05/11: the money in one
 * place, by service). A payment asks it again and refreshes the account.
 */
export function ServiceCollectionView(props: { target: ServiceAskTarget; service: CollectionRow; onBack: () => void; onPaid: () => void }) {
  const { target, service, onBack, onPaid } = props;
  const colors = useColores();
  const [round, setRound] = useState(0);
  const paid = useCallback(() => {
    setRound((count) => count + 1);
    onPaid();
  }, [onPaid]);
  const answer = useServiceAsk('billing', target, service.id, round);
  const files = useFileViewer();
  const detail = answer?.ok ? answer.value : null;
  // Android's BACK goes back to the account; the last listener added runs first.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);
  return (
    <ScrollView testID="cobranza-servicio" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Pressable testID="volver-a-cuenta" onPress={onBack} className="min-h-[40px] flex-row items-center gap-1 self-start">
        <ChevronLeft size={18} color={colors.primary} />
        <Text className="text-[14px] font-semibold text-primary">Cuenta</Text>
      </Pressable>
      <Text className="text-[18px] font-bold text-on-surface">{service.name}</Text>
      <SpaceActionButton jwt={target.jwt} spaceId={target.spaceId} values={serviceValuesOf(service.id)} onAnswered={paid} actionKey={PAYMENT_ACTION} label="Registrar pago" testID="registrar-pago" Icon={Plus} />
      {answer === null ? <View testID="cobranza-cargando" className="h-48 rounded-2xl bg-surface-variant" /> : null}
      {detail?.billing ? <ServiceBilling billing={detail.billing} invoices={invoicesOf(detail)} onOpenFile={files.open} /> : null}
      {detail && !detail.billing ? <Text className="rounded-xl border border-outline/15 bg-surface p-4 text-[14px] text-on-surface-variant">Este servicio todavía no tiene cobranza.</Text> : null}
      {answer && !answer.ok ? <Text testID="cobranza-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-[15px] font-semibold text-on-surface">{answer.message}</Text> : null}
      {files.notice ? <Text className="text-center text-[13px] text-error">{files.notice}</Text> : null}
      {files.viewer}
    </ScrollView>
  );
}

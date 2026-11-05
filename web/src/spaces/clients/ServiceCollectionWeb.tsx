import { useCallback, useState } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { invoicesOf, PAYMENT_ACTION, serviceValuesOf, type CollectionRow } from '@lilachat/shared';
import { usePortalFileViewer } from './PortalFileViewer';
import { ServiceBillingWeb } from './ServiceBillingWeb';
import { SpaceActionButtonWeb } from './SpaceActionButtonWeb';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';

/**
 * A service's «Cobranza», opened from «Cuenta» (José 05/11: the money in one
 * place, by service). A payment asks it again and refreshes the account.
 */
export function ServiceCollectionWeb(props: { target: ServiceAskTarget; service: CollectionRow; onBack: () => void; onPaid: () => void }) {
  const { target, service, onPaid } = props;
  const [round, setRound] = useState(0);
  const paid = useCallback(() => {
    setRound((count) => count + 1);
    onPaid();
  }, [onPaid]);
  const answer = useServiceAsk('billing', target, service.id, round);
  const viewer = usePortalFileViewer();
  const detail = answer?.ok ? answer.value : null;
  return (
    <div data-testid="cobranza-servicio" className="flex flex-col gap-3">
      <button type="button" data-testid="volver-a-cuenta" onClick={props.onBack} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-primary hover:underline"><ChevronLeft size={16} /> Cuenta</button>
      <h2 className="text-lg font-bold">{service.name}</h2>
      <SpaceActionButtonWeb jwt={target.jwt} spaceId={target.spaceId} values={serviceValuesOf(service.id)} onAnswered={paid} actionKey={PAYMENT_ACTION} label="Registrar pago" testId="registrar-pago" Icon={Plus} />
      {answer === null ? <div data-testid="cobranza-cargando" className="h-48 animate-pulse rounded-xl bg-surface" /> : null}
      {detail?.billing ? <ServiceBillingWeb billing={detail.billing} invoices={invoicesOf(detail)} onOpenFile={viewer.open} /> : null}
      {detail && !detail.billing ? <p className="rounded-xl border border-outline/15 bg-surface p-4 text-sm text-on-surface-variant">Este servicio todavía no tiene cobranza.</p> : null}
      {answer && !answer.ok ? <p data-testid="cobranza-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-sm font-semibold">{answer.message}</p> : null}
      {viewer.viewer}
    </div>
  );
}

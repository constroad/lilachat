import { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { PAYMENT_ACTION, answeredSince, formKeyOf, paymentValuesOf } from '@lilachat/shared';
import { loadPerfil } from '../../api';
import { AppFormDialog } from '../../chat/commands/AppFormDialog';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { useSpaceAction } from './useSpaceAction';

/**
 * «Registrar pago» in Cobranza (José 31/10: admins only, no approval step).
 * Portal refuses registrar_pago inside a group and the client's channel is one,
 * so it runs from the space with the service filled in. Its private answer stays
 * here, and an answered payment asks the detail again.
 */
export function RegisterPaymentWeb(props: { jwt: string; spaceId: string; serviceId: string; onPaid: () => void }) {
  const { row, answers } = useSpaceAction(props.jwt, props.spaceId, PAYMENT_ACTION, true);
  const seen = useRef(new Set<string>());
  const { onPaid } = props;
  useEffect(() => {
    const fresh = answeredSince(answers.answers, seen.current);
    fresh.forEach((id) => seen.current.add(id));
    if (fresh.length) onPaid();
  }, [answers.answers, onPaid]);
  if (!row) return null;
  return (
    <div className="space-y-2">
      <button type="button" data-testid="registrar-pago" onClick={() => void answers.runAction(row, paymentValuesOf(props.serviceId))} className="flex h-11 w-full items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-left text-sm font-semibold text-primary hover:bg-primary/15">
        <Plus size={16} />
        Registrar pago
      </button>
      <EphemeralAnswers answers={answers.answers} onDismiss={answers.dismiss} onOpenForm={answers.showForm} chatId="" jwt={props.jwt} />
      {answers.openForm ? (
        <AppFormDialog key={formKeyOf(answers.openForm)} answer={answers.openForm} personName={loadPerfil()?.name} onSubmit={(values) => answers.submitForm(answers.openForm!, values)} onUpload={(file, stamp) => answers.uploadPhoto(answers.openForm!.commandId, file, stamp)} onRefresh={(draft) => answers.refreshForm(answers.openForm!, draft)} onPreview={(draft) => answers.previewForm(answers.openForm!, draft)} onClose={() => answers.dismiss(answers.openForm!.commandId)} />
      ) : null}
    </div>
  );
}

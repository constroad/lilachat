import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { PAYMENT_ACTION, answeredSince, formKeyOf, paymentValuesOf } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { AppFormSheet } from '../../chat/commands/AppFormSheet';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { useSpaceAction } from './useSpaceAction';

/**
 * «Registrar pago» in Cobranza (José 31/10: admins only, no approval step).
 * Portal refuses registrar_pago inside a group and the client's channel is one,
 * so it runs from the space with the service filled in. Its private answer stays
 * here, and an answered payment asks the detail again.
 */
export function RegisterPayment(props: { jwt: string; spaceId: string; serviceId: string; onPaid: () => void }) {
  const colors = useColores();
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
    <View className="gap-2">
      <Pressable testID="registrar-pago" onPress={() => void answers.runAction(row, paymentValuesOf(props.serviceId))} className="min-h-[48px] flex-row items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3">
        <Plus size={18} color={colors.primary} />
        <Text className="flex-1 text-[15px] font-semibold text-primary">Registrar pago</Text>
      </Pressable>
      <EphemeralAnswers answers={answers.answers} onDismiss={answers.dismiss} onOpenForm={answers.showForm} chatId="" jwt={props.jwt} embedded />
      {answers.openForm ? (
        <AppFormSheet key={formKeyOf(answers.openForm)} answer={answers.openForm} onSubmit={(values) => answers.submitForm(answers.openForm!, values)} onUpload={(photo, stamp) => answers.uploadPhoto(answers.openForm!.commandId, photo, stamp)} onRefresh={(draft) => answers.refreshForm(answers.openForm!, draft)} onPreview={(draft) => answers.previewForm(answers.openForm!, draft)} onClose={() => answers.dismiss(answers.openForm!.commandId)} />
      ) : null}
    </View>
  );
}

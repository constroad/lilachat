import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { answeredSince, formKeyOf, type ShortcutValues } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { AppFormSheet } from '../../chat/commands/AppFormSheet';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { useSpaceAction } from './useSpaceAction';

/**
 * A service's button that runs a Portal action from the space: «Registrar
 * pago» in Cobranza and «Generar informe de servicio» in Informes. Portal
 * refuses both inside a group (they carry amounts) and the client's channel is
 * one, so they run from the space with the service filled in. The private
 * answer stays here, and an answered one asks the detail again.
 */
export function SpaceActionButton(props: { jwt: string; spaceId: string; actionKey: string; label: string; testID: string; Icon: LucideIcon; values: ShortcutValues; onAnswered: () => void }) {
  const colors = useColores();
  const { row, answers } = useSpaceAction(props.jwt, props.spaceId, props.actionKey, true);
  const seen = useRef(new Set<string>());
  const { onAnswered, Icon } = props;
  useEffect(() => {
    const fresh = answeredSince(answers.answers, seen.current);
    fresh.forEach((id) => seen.current.add(id));
    if (fresh.length) onAnswered();
  }, [answers.answers, onAnswered]);
  if (!row) return null;
  return (
    <View className="gap-2">
      <Pressable testID={props.testID} onPress={() => void answers.runAction(row, props.values)} className="min-h-[48px] flex-row items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3">
        <Icon size={18} color={colors.primary} />
        <Text className="flex-1 text-[15px] font-semibold text-primary">{props.label}</Text>
      </Pressable>
      <EphemeralAnswers answers={answers.answers} onDismiss={answers.dismiss} onOpenForm={answers.showForm} chatId="" jwt={props.jwt} embedded />
      {answers.openForm ? (
        <AppFormSheet key={formKeyOf(answers.openForm)} answer={answers.openForm} onSubmit={(values) => answers.submitForm(answers.openForm!, values)} onUpload={(photo, stamp) => answers.uploadPhoto(answers.openForm!.commandId, photo, stamp)} onRefresh={(draft) => answers.refreshForm(answers.openForm!, draft)} onPreview={(draft) => answers.previewForm(answers.openForm!, draft)} onClose={() => answers.dismiss(answers.openForm!.commandId)} />
      ) : null}
    </View>
  );
}

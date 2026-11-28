import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { formKeyOf, type ShortcutValues } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { AppFormSheet } from '../../chat/commands/AppFormSheet';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { useAnsweredSince } from '../../chat/commands/useAnsweredSince';
import { useSpaceAction } from './useSpaceAction';

/**
 * A service's button that runs a Portal action from the space: «Registrar
 * pago» in Cobranza («Informe de servicio» runs from the «Crear informe» picker). Portal
 * refuses both inside a group (they carry amounts) and the client's channel is
 * one, so they run from the space with the service filled in. The private
 * answer stays here, and an answered one asks the detail again.
 */
type SpaceActionProps = { jwt: string; spaceId: string; actionKey: string; values: ShortcutValues; onAnswered: () => void };

/** The action without its button (José 28/11: «Informe de servicio» lives in the «Crear informe» picker): its row, how to run it and its private answers. */
export function useSpaceActionRun(props: SpaceActionProps & { wanted: boolean }) {
  const { row, answers } = useSpaceAction(props.jwt, props.spaceId, props.actionKey, props.wanted);
  useAnsweredSince(answers.answers, props.onAnswered);
  const run = () => { if (row) void answers.runAction(row, props.values); };
  const panel = row ? (
    <>
      <EphemeralAnswers answers={answers.answers} onDismiss={answers.dismiss} onOpenForm={answers.showForm} chatId="" jwt={props.jwt} embedded />
      {answers.openForm ? (
        <AppFormSheet key={formKeyOf(answers.openForm)} answer={answers.openForm} onSubmit={(values) => answers.submitForm(answers.openForm!, values)} onUpload={(photo, stamp) => answers.uploadPhoto(answers.openForm!.commandId, photo, stamp)} onRefresh={(draft) => answers.refreshForm(answers.openForm!, draft)} onPreview={(draft) => answers.previewForm(answers.openForm!, draft)} onClose={() => answers.dismiss(answers.openForm!.commandId)} />
      ) : null}
    </>
  ) : null;
  return { offered: row !== null, run, panel };
}

export function SpaceActionButton(props: SpaceActionProps & { label: string; testID: string; Icon: LucideIcon }) {
  const colors = useColores();
  const action = useSpaceActionRun({ ...props, wanted: true });
  const { Icon } = props;
  if (!action.offered) return null;
  return (
    <View className="gap-2">
      <Pressable testID={props.testID} onPress={action.run} className="min-h-[48px] flex-row items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3">
        <Icon size={18} color={colors.primary} />
        <Text className="flex-1 text-[15px] font-semibold text-primary">{props.label}</Text>
      </Pressable>
      {action.panel}
    </View>
  );
}

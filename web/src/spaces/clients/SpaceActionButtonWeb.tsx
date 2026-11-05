import type { LucideIcon } from 'lucide-react';
import { formKeyOf, type ShortcutValues } from '@lilachat/shared';
import { loadPerfil } from '../../api';
import { AppFormDialog } from '../../chat/commands/AppFormDialog';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { useAnsweredSince } from '../../chat/commands/useAnsweredSince';
import { useSpaceAction } from './useSpaceAction';

/**
 * A service's button that runs a Portal action from the space: «Registrar
 * pago» in Cobranza and «Generar informe de servicio» in Informes. Portal
 * refuses both inside a group (they carry amounts) and the client's channel is
 * one, so they run from the space with the service filled in. The private
 * answer stays here, and an answered one asks the detail again.
 */
export function SpaceActionButtonWeb(props: { jwt: string; spaceId: string; actionKey: string; label: string; testId: string; Icon: LucideIcon; values: ShortcutValues; onAnswered: () => void }) {
  const { row, answers } = useSpaceAction(props.jwt, props.spaceId, props.actionKey, true);
  const { Icon } = props;
  useAnsweredSince(answers.answers, props.onAnswered);
  if (!row) return null;
  return (
    <div className="space-y-2">
      <button type="button" data-testid={props.testId} onClick={() => void answers.runAction(row, props.values)} className="flex h-11 w-full items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-left text-sm font-semibold text-primary hover:bg-primary/15">
        <Icon size={16} />
        {props.label}
      </button>
      <EphemeralAnswers answers={answers.answers} onDismiss={answers.dismiss} onOpenForm={answers.showForm} chatId="" jwt={props.jwt} />
      {answers.openForm ? (
        <AppFormDialog key={formKeyOf(answers.openForm)} answer={answers.openForm} personName={loadPerfil()?.name} onSubmit={(values) => answers.submitForm(answers.openForm!, values)} onUpload={(file, stamp) => answers.uploadPhoto(answers.openForm!.commandId, file, stamp)} onRefresh={(draft) => answers.refreshForm(answers.openForm!, draft)} onPreview={(draft) => answers.previewForm(answers.openForm!, draft)} onClose={() => answers.dismiss(answers.openForm!.commandId)} />
      ) : null}
    </div>
  );
}
